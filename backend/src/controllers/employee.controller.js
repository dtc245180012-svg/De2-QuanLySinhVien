// src/controllers/employee.controller.js - De 27 Member/Employee Controller
'use strict';

const fs   = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { body, param } = require('express-validator');
const { pool, toVectorLiteral } = require('../config/db');
const { runValidation } = require('../middleware/validation.middleware');
const { logger } = require('../config/logger');

const AI_WORKER_URL = process.env.AI_WORKER_URL || 'http://ai-worker:8000';

const createValidation = [
    body('employee_code').isString().trim().isLength({ min: 1, max: 32 }),
    body('full_name').isString().trim().isLength({ min: 1, max: 128 }),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('email invalid'),
    body('phone').optional().isString().isLength({ max: 20 }),
    body('department_id').optional().isInt(),
    body('position').optional().isString().isLength({ max: 64 }),
    body('hire_date').optional().isISO8601().withMessage('hire_date must be YYYY-MM-DD'),
    runValidation,
];

const updateValidation = [
    param('id').isInt(),
    runValidation,
];

async function syncExpiredLeaves() {
    try {
        const res = await pool.query(`
            UPDATE employees
            SET status = 'active', leave_start = NULL, leave_end = NULL, updated_at = NOW()
            WHERE status = 'on_leave' AND leave_end IS NOT NULL AND leave_end < CURRENT_DATE
        `);
        return res.rowCount || 0;
    } catch (e) {
        logger.error('syncExpiredLeaves error', { err: e.message });
        return 0;
    }
}

async function list(req, res) {
    const { search = '', department_id, status = 'active', limit = 50, offset = 0 } = req.query;
    try {
        await syncExpiredLeaves();
        const params = [];
        const where = [];
        if (search) {
            params.push(`%${search}%`);
            where.push('(e.full_name LIKE ? OR e.employee_code LIKE ?)');
            params.push(`%${search}%`);
        }
        if (department_id) {
            params.push(parseInt(department_id, 10));
            where.push('e.department_id = ?');
        }
        if (status) {
            params.push(status);
            where.push('e.status = ?');
        }
        params.push(parseInt(limit, 10));
        params.push(parseInt(offset, 10));
        const sql = `
            SELECT e.id, e.employee_code, e.full_name, e.email, e.phone,
                   e.department_id, d.name AS department_name,
                   e.position, DATE_FORMAT(e.hire_date, '%Y-%m-%d') AS hire_date, e.status,
                   DATE_FORMAT(e.leave_start, '%Y-%m-%d') AS leave_start,
                   DATE_FORMAT(e.leave_end, '%Y-%m-%d') AS leave_end,
                   e.work_start, e.work_end, e.shift_name, e.face_image_path,
                   e.created_at, e.updated_at,
                   (e.face_embedding IS NOT NULL) AS has_face
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
            ORDER BY e.id DESC
            LIMIT ? OFFSET ?
        `;
        const r = await pool.query(sql, params);
        return res.json({ ok: true, data: r.rows });
    } catch (err) {
        logger.error('list employees', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to list members' });
    }
}

async function getOne(req, res) {
    const id = parseInt(req.params.id, 10);
    try {
        await syncExpiredLeaves();
        const r = await pool.query(
            `SELECT e.id, e.employee_code, e.full_name, e.email, e.phone,
                    e.department_id, d.name AS department_name,
                    e.position, DATE_FORMAT(e.hire_date, '%Y-%m-%d') AS hire_date, e.status,
                    DATE_FORMAT(e.leave_start, '%Y-%m-%d') AS leave_start,
                    DATE_FORMAT(e.leave_end, '%Y-%m-%d') AS leave_end,
                    e.work_start, e.work_end, e.shift_name, e.face_image_path,
                    e.created_at, e.updated_at,
                    (e.face_embedding IS NOT NULL) AS has_face
             FROM employees e
             LEFT JOIN departments d ON d.id = e.department_id
             WHERE e.id = ?`,
            [id]
        );
        if (r.rowCount === 0) return res.status(404).json({ ok: false, error: 'Not found' });
        return res.json({ ok: true, data: r.rows[0] });
    } catch (err) {
        logger.error('get employee', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Lookup failed' });
    }
}

async function create(req, res) {
    const { employee_code, full_name, email, phone, department_id, position, hire_date, work_start, work_end, shift_name } = req.body;
    const file = req.file;

    try {
        let embedding = null;
        let facePath = null;
        if (file) {
            facePath = path.basename(file.path);
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
                if (aiResp.data && Array.isArray(aiResp.data.data) && aiResp.data.data.length > 0) {
                    embedding = aiResp.data.data[0].embedding;
                }
            } catch (aiErr) {
                logger.error('AI worker call failed on create', { err: aiErr.message });
            }
        }

        const insertSql = `
            INSERT INTO employees
                (employee_code, full_name, email, phone, department_id, position, hire_date,
                 work_start, work_end, shift_name, face_embedding, face_image_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const insResult = await pool.query(insertSql, [
            employee_code, full_name, email || null, phone || null,
            department_id ? parseInt(department_id, 10) : null, position || null, hire_date || null,
            work_start || '07:00', work_end || '11:30', shift_name || 'Ca sáng (07:00 - 11:30)',
            embedding ? JSON.stringify(embedding) : null,
            facePath,
        ]);

        const newId = insResult.insertId;
        const fetchR = await pool.query(
            `SELECT id, employee_code, full_name, email, phone, department_id,
                    position, DATE_FORMAT(hire_date, '%Y-%m-%d') AS hire_date, status, work_start, work_end, shift_name, face_image_path,
                    (face_embedding IS NOT NULL) AS has_face
             FROM employees WHERE id = ?`,
            [newId]
        );

        await pool.query(
            'INSERT INTO audit_log (user_id, action, entity, entity_id, payload) VALUES (?, "create", "employee", ?, ?)',
            [req.user.sub, newId, JSON.stringify({ employee_code, has_face: !!embedding })]
        );

        return res.status(201).json({ ok: true, data: fetchR.rows[0] });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || err.message.includes('Duplicate entry')) {
            return res.status(409).json({ ok: false, error: 'Mã hoặc email đã tồn tại trong hệ thống' });
        }
        logger.error('create employee', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Không thể thêm mới: ' + err.message });
    }
}

async function update(req, res) {
    const id = parseInt(req.params.id, 10);
    const { full_name, email, phone, department_id, position, status, work_start, work_end, shift_name, leave_start, leave_end } = req.body;
    const file = req.file;
    try {
        let embedding = null;
        let facePath  = null;
        if (file) {
            facePath = path.basename(file.path);
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
                if (aiResp.data && Array.isArray(aiResp.data.data) && aiResp.data.data.length > 0) {
                    embedding = aiResp.data.data[0].embedding;
                }
            } catch (aiErr) {
                logger.error('AI worker call failed on update', { err: aiErr.message });
            }
        }

        let leaveStartVal = status === 'active' ? null : (leave_start || null);
        let leaveEndVal = status === 'active' ? null : (leave_end || null);

        await pool.query(
            `UPDATE employees SET
                full_name       = COALESCE(?, full_name),
                email           = COALESCE(?, email),
                phone           = COALESCE(?, phone),
                department_id   = COALESCE(?, department_id),
                position        = COALESCE(?, position),
                status          = COALESCE(?, status),
                work_start      = COALESCE(?, work_start),
                work_end        = COALESCE(?, work_end),
                shift_name      = COALESCE(?, shift_name),
                face_embedding  = COALESCE(?, face_embedding),
                face_image_path = COALESCE(?, face_image_path),
                leave_start     = (CASE WHEN ? = 'active' THEN NULL WHEN ? = 'on_leave' THEN COALESCE(?, CURRENT_DATE) ELSE leave_start END),
                leave_end       = (CASE WHEN ? = 'active' THEN NULL WHEN ? = 'on_leave' THEN COALESCE(?, CURRENT_DATE) ELSE leave_end END)
            WHERE id = ?`,
            [
                full_name || null, email || null, phone || null,
                department_id ? parseInt(department_id, 10) : null, position || null, status || null,
                work_start || null, work_end || null, shift_name || null,
                embedding ? JSON.stringify(embedding) : null, facePath || null,
                status || null, status || null, leaveStartVal,
                status || null, status || null, leaveEndVal,
                id
            ]
        );

        const r = await pool.query(
            `SELECT id, employee_code, full_name, email, phone, department_id,
                    position, DATE_FORMAT(hire_date, '%Y-%m-%d') AS hire_date, status,
                    DATE_FORMAT(leave_start, '%Y-%m-%d') AS leave_start,
                    DATE_FORMAT(leave_end, '%Y-%m-%d') AS leave_end,
                    work_start, work_end, shift_name, face_image_path,
                    (face_embedding IS NOT NULL) AS has_face
             FROM employees WHERE id = ?`,
            [id]
        );

        if (r.rowCount === 0) return res.status(404).json({ ok: false, error: 'Not found' });

        await pool.query(
            'INSERT INTO audit_log (user_id, action, entity, entity_id, payload) VALUES (?, "update", "employee", ?, ?)',
            [req.user.sub, id, JSON.stringify({ has_face: r.rows[0].has_face, status: r.rows[0].status })]
        );
        return res.json({ ok: true, data: r.rows[0] });
    } catch (err) {
        logger.error('update employee', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to update: ' + err.message });
    }
}

async function softDelete(req, res) {
    const id = parseInt(req.params.id, 10);
    const hard = req.query.hard === 'true';
    try {
        if (hard) {
            await pool.query('DELETE FROM employees WHERE id = ?', [id]);
            await pool.query('INSERT INTO audit_log (user_id, action, entity, entity_id) VALUES (?, "delete", "employee", ?)', [req.user.sub, id]);
            return res.json({ ok: true, data: { id, deleted: true } });
        }
        await pool.query("UPDATE employees SET status = 'terminated' WHERE id = ?", [id]);
        await pool.query('INSERT INTO audit_log (user_id, action, entity, entity_id) VALUES (?, "terminate", "employee", ?)', [req.user.sub, id]);
        return res.json({ ok: true, data: { id, status: 'terminated' } });
    } catch (err) {
        logger.error('delete employee', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Failed' });
    }
}

async function bulkShift(req, res) {
    const { employee_ids, shift_name, work_start, work_end } = req.body;
    if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
        return res.status(400).json({ ok: false, error: 'employee_ids must be a non-empty array' });
    }
    if (!work_start || !work_end) {
        return res.status(400).json({ ok: false, error: 'work_start and work_end are required' });
    }
    try {
        const placeholders = employee_ids.map(() => '?').join(',');
        const params = [shift_name || 'Tùy chỉnh', work_start, work_end, ...employee_ids];
        const r = await pool.query(
            `UPDATE employees
             SET shift_name = ?, work_start = ?, work_end = ?
             WHERE id IN (${placeholders})`,
            params
        );
        const updatedRows = await pool.query(
            `SELECT id, employee_code, full_name, shift_name, work_start, work_end FROM employees WHERE id IN (${placeholders})`,
            employee_ids
        );
        await pool.query(
            'INSERT INTO audit_log (user_id, action, entity, payload) VALUES (?, "bulk_shift", "employee", ?)',
            [req.user.sub, JSON.stringify({ count: r.rowCount, shift_name, work_start, work_end })]
        );
        return res.json({ ok: true, data: { updated_count: r.rowCount, employees: updatedRows.rows } });
    } catch (err) {
        logger.error('bulk shift update', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to update shifts' });
    }
}

module.exports = {
    list, getOne, create, update, softDelete, bulkShift,
    createValidation, updateValidation, syncExpiredLeaves,
};
