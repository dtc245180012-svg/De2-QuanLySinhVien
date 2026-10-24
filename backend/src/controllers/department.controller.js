// src/controllers/department.controller.js - De 27 Department/Class Controller
'use strict';

const { body } = require('express-validator');
const { pool } = require('../config/db');
const { runValidation } = require('../middleware/validation.middleware');
const { logger } = require('../config/logger');

const createValidation = [
    body('name').isString().trim().isLength({ min: 1, max: 128 }),
    body('description').optional({ nullable: true, values: 'null' }).isString().isLength({ max: 1000 }),
    runValidation,
];

async function list(req, res) {
    try {
        const r = await pool.query(
            `SELECT d.id, d.name, d.description, d.created_at,
                    (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id) AS employee_count
             FROM departments d ORDER BY d.name ASC`
        );
        return res.json({ ok: true, data: r.rows });
    } catch (err) {
        logger.error('list depts', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to list departments' });
    }
}

async function create(req, res) {
    const { name, description } = req.body;
    try {
        const ins = await pool.query(
            'INSERT INTO departments (name, description) VALUES (?, ?)',
            [name, description || null]
        );
        const newId = ins.insertId;
        const fetchR = await pool.query(
            'SELECT id, name, description, created_at FROM departments WHERE id = ?',
            [newId]
        );
        await pool.query(
            'INSERT INTO audit_log (user_id, action, entity, entity_id) VALUES (?, "create", "department", ?)',
            [req.user.sub, newId]
        );
        return res.status(201).json({ ok: true, data: fetchR.rows[0] });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || err.message.includes('Duplicate entry')) {
            return res.status(409).json({ ok: false, error: 'Tên Lớp học / Khoa đã tồn tại' });
        }
        logger.error('create dept', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to create department' });
    }
}

async function update(req, res) {
    const id = parseInt(req.params.id, 10);
    const { name, description } = req.body;
    try {
        await pool.query(
            `UPDATE departments SET name = COALESCE(?, name),
                                    description = COALESCE(?, description)
             WHERE id = ?`,
            [name || null, description || null, id]
        );
        const fetchR = await pool.query(
            'SELECT id, name, description, created_at, updated_at FROM departments WHERE id = ?',
            [id]
        );
        if (fetchR.rowCount === 0) return res.status(404).json({ ok: false, error: 'Not found' });
        return res.json({ ok: true, data: fetchR.rows[0] });
    } catch (err) {
        logger.error('update dept', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to update department' });
    }
}

async function softDelete(req, res) {
    const id = parseInt(req.params.id, 10);
    try {
        await pool.query('UPDATE employees SET department_id = NULL WHERE department_id = ?', [id]);
        const r = await pool.query('DELETE FROM departments WHERE id = ?', [id]);
        if (r.rowCount === 0) return res.status(404).json({ ok: false, error: 'Not found' });
        return res.json({ ok: true, data: { id } });
    } catch (err) {
        logger.error('delete dept', { err: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to delete department' });
    }
}

module.exports = { list, create, update, softDelete, createValidation };
