// src/controllers/attendance.controller.js - De 27 Attendance Controller
'use strict';

const fs   = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { query } = require('express-validator');
const { pool, cosineDistance } = require('../config/db');
const { runValidation } = require('../middleware/validation.middleware');
const { logger } = require('../config/logger');

const AI_WORKER_URL = process.env.AI_WORKER_URL || 'http://ai-worker:8000';
const FACE_MATCH_THRESHOLD = parseFloat(process.env.FACE_MATCH_THRESHOLD || '0.45');
const WORK_START = process.env.WORK_START || '07:00';
const WORK_END   = process.env.WORK_END   || '11:30';
const LATE_GRACE = parseInt(process.env.LATE_GRACE_MINUTES || '5', 10);
const EARLY_GRACE = parseInt(process.env.EARLY_LEAVE_GRACE_MINUTES || '5', 10);

function timeToMinutes(t) {
    if (!t) return 0;
    const parts = t.toString().slice(0, 5).split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function statusForCheckIn(now, dateStr, empStart) {
    const cur = now.getHours() * 60 + now.getMinutes();
    const startStr = empStart || WORK_START;
    const start = timeToMinutes(startStr) + LATE_GRACE;
    return cur <= start ? 'on_time' : 'late';
}

function statusForCheckOut(now, empEnd) {
    const cur = now.getHours() * 60 + now.getMinutes();
    const endStr = empEnd || WORK_END;
    const end = timeToMinutes(endStr) - EARLY_GRACE;
    return cur >= end ? 'on_time' : 'early_leave';
}

/**
 * POST /api/attendance/face-check
 * Facial recognition attendance
 */
async function faceCheck(req, res) {
    const file = req.file;
    if (!file) return res.status(400).json({ ok: false, error: 'Yêu cầu tệp hình ảnh khuôn mặt' });

    let faces = [];
    try {
        const form = new FormData();
        form.append('files', fs.createReadStream(file.path), {
            filename: file.originalname,
            contentType: file.mimetype,
        });
        const aiResp = await axios.post(`${AI_WORKER_URL}/extract_faces`, form, {
            headers: form.getHeaders(),
            timeout: 30_000,
            maxBodyLength: 10 * 1024 * 1024,
        });
        faces = (aiResp.data && aiResp.data.data) || [];
    } catch (err) {
        logger.error('AI worker call failed', { err: err.message });
        return res.status(502).json({ ok: false, error: 'Dịch vụ AI nhận diện không khả dụng' });
    }

    try {
        if (faces.length === 0) {
            logger.info('face_check: no face detected', { file: file.originalname });
            return res.status(400).json({ ok: false, error: 'NO_FACE', message: 'Không phát hiện khuôn mặt trong ảnh' });
        }

        const embedding = faces[0].embedding;
        if (!embedding || !Array.isArray(embedding) || embedding.length !== 512) {
            return res.status(500).json({ ok: false, error: 'Lỗi định dạng vector đặc trưng từ dịch vụ AI' });
        }

        // 1) Match nearest employee using cosine similarity in Node.js
        const allEmps = await pool.query(
            "SELECT id, employee_code, full_name, work_start, work_end, face_embedding FROM employees WHERE face_embedding IS NOT NULL AND status = 'active'"
        );

        if (allEmps.rowCount === 0) {
            return res.status(404).json({ ok: false, error: 'NO_ENROLLED_EMPLOYEE', message: 'Chưa có sinh viên/nhân viên nào đăng ký khuôn mặt trong hệ thống' });
        }

        let bestEmp = null;
        let minDistance = Infinity;

        for (const emp of allEmps.rows) {
            let empEmb = emp.face_embedding;
            if (typeof empEmb === 'string') {
                try { empEmb = JSON.parse(empEmb); } catch (e) { continue; }
            }
            if (!Array.isArray(empEmb)) continue;
            const dist = cosineDistance(embedding, empEmb);
            if (dist < minDistance) {
                minDistance = dist;
                bestEmp = { ...emp, distance: dist };
            }
        }

        if (!bestEmp) {
            return res.status(404).json({ ok: false, error: 'NO_ENROLLED_EMPLOYEE', message: 'Chưa có khuôn mặt hợp lệ trong hệ thống' });
        }

        const emp = bestEmp;
        const distance = parseFloat(emp.distance);
        if (distance > FACE_MATCH_THRESHOLD) {
            logger.info('face_check: no match', { distance, threshold: FACE_MATCH_THRESHOLD });
            return res.json({
                ok: true,
                data: {
                    matched: false,
                    distance,
                    threshold: FACE_MATCH_THRESHOLD,
                    bounding_box: faces[0].bounding_box,
                },
            });
        }

        // 2) Insert check_in or check_out for today
        const now = new Date();
        const localNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
        const localDate = localNow.toISOString().slice(0, 10);

        const existing = await pool.query(
            'SELECT id, check_in, check_out, status FROM attendance WHERE employee_id = ? AND date = ?',
            [emp.id, localDate]
        );

        if (existing.rowCount === 0) {
            // Check-in
            const status = statusForCheckIn(localNow, localDate, emp.work_start);
            await pool.query(
                `INSERT INTO attendance
                    (employee_id, date, check_in, status, check_in_status, check_in_method, confidence_in)
                 VALUES (?, ?, NOW(), ?, ?, 'face', ?)`,
                [emp.id, localDate, status, status, (1 - distance).toFixed(4)]
            );
            const ins = await pool.query(
                `SELECT id, date, check_in, status, check_in_status, check_out_status
                 FROM attendance WHERE employee_id = ? AND date = ?`,
                [emp.id, localDate]
            );
            logger.info('face_check: check_in', { emp_id: emp.id, status, distance });
            return res.json({
                ok: true,
                data: {
                    matched: true,
                    action: 'check_in',
                    employee: { id: emp.id, employee_code: emp.employee_code, full_name: emp.full_name, work_start: emp.work_start, work_end: emp.work_end },
                    distance,
                    threshold: FACE_MATCH_THRESHOLD,
                    confidence: (1 - distance).toFixed(4),
                    attendance: ins.rows[0],
                },
            });
        }

        const row = existing.rows[0];
        if (!row.check_out) {
            // Check-out
            const statusOut = statusForCheckOut(localNow, emp.work_end);
            await pool.query(
                `UPDATE attendance
                 SET check_out = NOW(), check_out_status = ?,
                     status = (CASE WHEN status = 'late' THEN 'late' ELSE ? END),
                     check_out_method = 'face',
                     confidence_out = ?
                 WHERE id = ?`,
                [statusOut, statusOut, (1 - distance).toFixed(4), row.id]
            );
            const up = await pool.query(
                `SELECT id, date, check_in, check_out, status, check_in_status, check_out_status
                 FROM attendance WHERE id = ?`,
                [row.id]
            );
            logger.info('face_check: check_out', { emp_id: emp.id, statusOut, distance });
            return res.json({
                ok: true,
                data: {
                    matched: true,
                    action: 'check_out',
                    employee: { id: emp.id, employee_code: emp.employee_code, full_name: emp.full_name },
                    distance,
                    threshold: FACE_MATCH_THRESHOLD,
                    confidence: (1 - distance).toFixed(4),
                    attendance: up.rows[0],
                },
            });
        }

        // Already both in & out
        return res.json({
            ok: true,
            data: {
                matched: true,
                action: 'none',
                message: 'Đã hoàn thành điểm danh vào và ra cho ngày hôm nay',
                employee: { id: emp.id, employee_code: emp.employee_code, full_name: emp.full_name },
                distance,
                attendance: row,
            },
        });
    } catch (err) {
        logger.error('face_check processing failed', { err: err.message, stack: err.stack });
        return res.status(500).json({ ok: false, error: 'Lỗi ghi nhận điểm danh: ' + err.message });
    }
}

async function manualCheck(req, res) {
    const { employee_id, type, note } = req.body;
    const localNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const localDate = localNow.toISOString().slice(0, 10);
    try {
        const empR = await pool.query('SELECT work_start, work_end FROM employees WHERE id = ?', [employee_id]);
        const empStart = empR.rows[0] ? empR.rows[0].work_start : WORK_START;
        const empEnd = empR.rows[0] ? empR.rows[0].work_end : WORK_END;

        const existing = await pool.query(
            'SELECT id, check_in, check_out FROM attendance WHERE employee_id = ? AND date = ?',
            [employee_id, localDate]
        );
        if (type === 'in') {
            if (existing.rowCount > 0 && existing.rows[0].check_in) {
                return res.status(409).json({ ok: false, error: 'Hôm nay sinh viên/nhân viên đã điểm danh vào rồi' });
            }
            const status = statusForCheckIn(localNow, localDate, empStart);
            if (existing.rowCount === 0) {
                await pool.query(
                    `INSERT INTO attendance (employee_id, date, check_in, status, check_in_status, check_in_method, note)
                     VALUES (?, ?, NOW(), ?, ?, 'manual', ?)`,
                    [employee_id, localDate, status, status, note || null]
                );
            } else {
                await pool.query(
                    `UPDATE attendance SET check_in = NOW(), status = ?, check_in_status = ?, check_in_method = 'manual', note = ?
                     WHERE id = ?`,
                    [status, status, note || null, existing.rows[0].id]
                );
            }
            const r = await pool.query('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, localDate]);
            return res.json({ ok: true, data: r.rows[0] });
        }
        if (type === 'out') {
            if (existing.rowCount === 0 || !existing.rows[0].check_in) {
                return res.status(409).json({ ok: false, error: 'Cần điểm danh vào trước khi điểm danh ra' });
            }
            const statusOut = statusForCheckOut(localNow, empEnd);
            await pool.query(
                `UPDATE attendance SET check_out = NOW(), check_out_status = ?,
                        status = (CASE WHEN status = 'late' THEN 'late' ELSE ? END),
                        check_out_method = 'manual'
                 WHERE id = ?`,
                [statusOut, statusOut, existing.rows[0].id]
            );
            const r = await pool.query('SELECT * FROM attendance WHERE id = ?', [existing.rows[0].id]);
            return res.json({ ok: true, data: r.rows[0] });
        }
        return res.status(400).json({ ok: false, error: 'Loại điểm danh phải là in (vào) hoặc out (ra)' });
    } catch (err) {
        logger.error('manual check', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Lỗi điểm danh thủ công: ' + err.message });
    }
}

const listValidation = [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('employee_id').optional().isInt(),
    query('limit').optional().isInt({ min: 1, max: 500 }),
    query('offset').optional().isInt({ min: 0 }),
    runValidation,
];

async function list(req, res) {
    const { from, to, employee_id, limit = 100, offset = 0 } = req.query;
    const where = [];
    const params = [];
    if (from) { params.push(from); where.push('a.date >= ?'); }
    if (to)   { params.push(to);   where.push('a.date <= ?'); }
    if (employee_id) { params.push(parseInt(employee_id, 10)); where.push('a.employee_id = ?'); }
    
    const limitVal = parseInt(limit, 10);
    const offsetVal = parseInt(offset, 10);
    params.push(limitVal);
    params.push(offsetVal);

    const sql = `
        SELECT a.id, a.employee_id, e.employee_code, e.full_name,
               DATE_FORMAT(a.date, '%Y-%m-%d') AS date, a.check_in, a.check_out, a.status,
               a.check_in_status, a.check_out_status,
               a.check_in_method, a.check_out_method,
               a.confidence_in, a.confidence_out, a.note
        FROM attendance a
        JOIN employees e ON e.id = a.employee_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY a.date DESC, a.employee_id ASC
        LIMIT ? OFFSET ?
    `;
    try {
        const r = await pool.query(sql, params);
        return res.json({ ok: true, data: r.rows });
    } catch (err) {
        logger.error('list attendance', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Lỗi tải danh sách chấm công' });
    }
}

async function myHistory(req, res) {
    const empId = req.user.employee_id;
    const limit = Math.min(parseInt(req.query.limit || '30', 10), 200);
    try {
        if (!empId) {
            if (req.user.role === 'admin' || req.user.role === 'hr') {
                const r = await pool.query(
                    `SELECT a.id, DATE_FORMAT(a.date, '%Y-%m-%d') AS date, a.check_in, a.check_out, a.status,
                            a.check_in_status, a.check_out_status,
                            a.check_in_method, a.check_out_method,
                            a.confidence_in, a.confidence_out,
                            e.employee_code, e.full_name, d.name AS department_name
                     FROM attendance a
                     JOIN employees e ON e.id = a.employee_id
                     LEFT JOIN departments d ON d.id = e.department_id
                     ORDER BY a.date DESC, COALESCE(a.check_out, a.check_in) DESC
                     LIMIT ?`,
                    [limit]
                );
                return res.json({ ok: true, data: r.rows, is_all: true });
            }
            return res.status(403).json({ ok: false, error: 'Tài khoản chưa được liên kết với hồ sơ điểm danh' });
        }
        const r = await pool.query(
            `SELECT a.id, DATE_FORMAT(a.date, '%Y-%m-%d') AS date, a.check_in, a.check_out, a.status,
                    a.check_in_status, a.check_out_status,
                    a.check_in_method, a.check_out_method,
                    a.confidence_in, a.confidence_out,
                    e.employee_code, e.full_name
             FROM attendance a
             JOIN employees e ON e.id = a.employee_id
             WHERE a.employee_id = ?
             ORDER BY a.date DESC, COALESCE(a.check_out, a.check_in) DESC
             LIMIT ?`,
            [empId, limit]
        );
        return res.json({ ok: true, data: r.rows, is_all: false });
    } catch (err) {
        logger.error('my history', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Lỗi tải lịch sử chấm công' });
    }
}

module.exports = {
    faceCheck, manualCheck, list, myHistory,
    listValidation,
    internal: { statusForCheckIn, statusForCheckOut, timeToMinutes, FACE_MATCH_THRESHOLD },
};
