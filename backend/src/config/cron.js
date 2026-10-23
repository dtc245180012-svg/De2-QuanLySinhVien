// src/config/cron.js - mark absent for previous workday at 23:00 daily
'use strict';

const cron = require('node-cron');
const { pool } = require('./db');
const { logger } = require('./logger');

async function markAbsentForDate(dateStr) {
    const sql = `
        INSERT IGNORE INTO attendance (employee_id, date, status, check_in_method, note)
        SELECT e.id, ?, 'absent', 'manual', 'auto-marked by cron'
        FROM employees e
        LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = ?
        WHERE e.status = 'active' AND a.id IS NULL
    `;
    const r = await pool.query(sql, [dateStr, dateStr]);
    logger.info('Marked absent', { date: dateStr, count: r.rowCount });
    return r.rowCount;
}

const { syncExpiredLeaves } = require('../controllers/employee.controller');

function scheduleAbsentJob() {
    cron.schedule('0 0 * * *', async () => {
        try {
            await syncExpiredLeaves();
        } catch (err) {
            logger.error('Sync expired leaves cron failed', { err: err.message });
        }
    }, { timezone: 'Asia/Ho_Chi_Minh' });

    cron.schedule('0 23 * * *', async () => {
        try {
            const localNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
            const todayStr = localNow.toISOString().slice(0, 10);
            await syncExpiredLeaves();
            await markAbsentForDate(todayStr);
        } catch (err) {
            logger.error('Absent cron failed', { err: err.message });
        }
    }, { timezone: 'Asia/Ho_Chi_Minh' });
    logger.info('Absent cron scheduled (23:00 daily)');
}

module.exports = { scheduleAbsentJob, markAbsentForDate };
