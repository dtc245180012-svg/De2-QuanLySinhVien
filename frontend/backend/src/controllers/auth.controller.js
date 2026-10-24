// src/controllers/auth.controller.js - De 27 Auth Controller
'use strict';

const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { pool } = require('../config/db');
const { signToken } = require('../middleware/auth.middleware');
const { runValidation } = require('../middleware/validation.middleware');
const { logger } = require('../config/logger');

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

const loginValidation = [
    body('username').isString().trim().notEmpty().withMessage('username required'),
    body('password').isString().notEmpty().withMessage('password required'),
];

const registerValidation = [
    body('username').isString().trim().isLength({ min: 3, max: 64 }),
    body('password').isString().isLength({ min: 8, max: 128 }),
    body('role').isIn(['admin', 'hr', 'employee', 'kiosk']),
    body('employee_id').optional().isInt(),
];

async function login(req, res) {
    const { username, password } = req.body;
    try {
        const r = await pool.query(
            `SELECT id, username, password_hash, role, employee_id, is_active
             FROM users WHERE username = ? LIMIT 1`,
            [username]
        );
        if (r.rowCount === 0) {
            return res.status(401).json({ ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu' });
        }
        const u = r.rows[0];
        if (!u.is_active) {
            return res.status(403).json({ ok: false, error: 'Tài khoản đã bị vô hiệu hóa' });
        }
        const ok = await bcrypt.compare(password, u.password_hash);
        if (!ok) {
            return res.status(401).json({ ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu' });
        }
        await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [u.id]);
        const token = signToken(u);
        logger.info('Login success', { user_id: u.id, username: u.username, role: u.role });
        return res.json({
            ok: true,
            data: {
                token,
                user: { id: u.id, username: u.username, role: u.role, employee_id: u.employee_id },
            },
        });
    } catch (err) {
        logger.error('login error', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Đăng nhập thất bại: ' + err.message });
    }
}

async function register(req, res) {
    const { username, password, role, employee_id } = req.body;
    try {
        const exists = await pool.query('SELECT 1 FROM users WHERE username = ?', [username]);
        if (exists.rowCount > 0) {
            return res.status(409).json({ ok: false, error: 'Tên người dùng đã tồn tại' });
        }
        const hash = await bcrypt.hash(password, ROUNDS);
        const ins = await pool.query(
            `INSERT INTO users (username, password_hash, role, employee_id)
             VALUES (?, ?, ?, ?)`,
            [username, hash, role, employee_id || null]
        );
        const newId = ins.insertId;
        const fetchR = await pool.query(
            'SELECT id, username, role, employee_id, created_at FROM users WHERE id = ?',
            [newId]
        );
        await pool.query(
            'INSERT INTO audit_log (user_id, action, entity, entity_id, payload) VALUES (?, "create", "user", ?, ?)',
            [req.user.sub, newId, JSON.stringify({ username, role })]
        );
        return res.status(201).json({ ok: true, data: fetchR.rows[0] });
    } catch (err) {
        logger.error('register error', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Đăng ký thất bại: ' + err.message });
    }
}

async function me(req, res) {
    try {
        const r = await pool.query(
            `SELECT u.id, u.username, u.role, u.employee_id, u.last_login_at,
                    e.full_name, e.employee_code, e.email
             FROM users u
             LEFT JOIN employees e ON e.id = u.employee_id
             WHERE u.id = ?`,
            [req.user.sub]
        );
        if (r.rowCount === 0) return res.status(404).json({ ok: false, error: 'Không tìm thấy người dùng' });
        return res.json({ ok: true, data: r.rows[0] });
    } catch (err) {
        logger.error('me error', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Lỗi tra cứu: ' + err.message });
    }
}

module.exports = { login, register, me, loginValidation, registerValidation };
