// src/controllers/dashboard.controller.js - De 27 Dashboard Controller
'use strict';

const { pool } = require('../config/db');
const { logger } = require('../config/logger');
const { syncExpiredLeaves } = require('./employee.controller');

function getVietnamDateStr() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(new Date());
}

async function overview(req, res) {
    try {
        await syncExpiredLeaves();
        const { from, to, department_id, status, search, cal_month } = req.query;

        const todayStr = getVietnamDateStr();

        const startDate = from || todayStr;
        const endDate = to || todayStr;

        // 1) Employee counts
        let empSql = `SELECT
            COALESCE(SUM(CASE WHEN status='active' THEN 1 ELSE 0 END), 0)     AS active_employees,
            COALESCE(SUM(CASE WHEN status='terminated' THEN 1 ELSE 0 END), 0) AS terminated_employees,
            COALESCE(SUM(CASE WHEN status='on_leave' THEN 1 ELSE 0 END), 0)   AS on_leave_employees,
            COUNT(*)                                                          AS total_employees
         FROM employees`;
        const empParams = [];
        if (department_id) {
            empParams.push(parseInt(department_id, 10));
            empSql += ` WHERE department_id = ?`;
        }
        const empCount = await pool.query(empSql, empParams);
        const deptCount = await pool.query(`SELECT COUNT(*) AS total FROM departments`);

        // 2) Stats breakdown for selected period & department
        let deptConditionAtt = '';
        let deptConditionEmp = '';
        const statParams = [startDate, endDate];
        if (department_id) {
            statParams.push(parseInt(department_id, 10));
            deptConditionAtt = ` AND e.department_id = ?`;
            deptConditionEmp = ` AND e.department_id = ?`;
        }

        const statSql = `
            SELECT
                COALESCE(SUM(CASE WHEN status != 'absent' AND (check_in_status = 'on_time' OR (check_in_status IS NULL AND status IN ('on_time', 'early_leave'))) THEN 1 ELSE 0 END), 0) AS on_time,
                COALESCE(SUM(CASE WHEN check_in_status = 'late' OR (check_in_status IS NULL AND status = 'late') THEN 1 ELSE 0 END), 0) AS late,
                COALESCE(SUM(CASE WHEN check_out_status = 'early_leave' OR (check_out_status IS NULL AND status = 'early_leave') THEN 1 ELSE 0 END), 0) AS early_leave,
                COALESCE(SUM(CASE WHEN status = 'absent' OR check_in_status = 'absent' THEN 1 ELSE 0 END), 0) AS absent,
                COUNT(*) AS total
            FROM (
                SELECT a.id, a.check_in_status, a.check_out_status, a.status
                FROM attendance a
                JOIN employees e ON e.id = a.employee_id
                WHERE a.date >= ? AND a.date <= ?
                  ${deptConditionAtt}
                UNION ALL
                SELECT NULL AS id, 'absent' AS check_in_status, NULL AS check_out_status, 'absent' AS status
                FROM employees e
                WHERE e.status = 'active'
                  ${deptConditionEmp}
                  AND NOT EXISTS (
                      SELECT 1 FROM attendance a
                      WHERE a.employee_id = e.id AND a.date >= ? AND a.date <= ?
                  )
            ) all_records
        `;
        // Pass params for both UNION parts
        const fullStatParams = department_id
            ? [startDate, endDate, parseInt(department_id, 10), parseInt(department_id, 10), startDate, endDate]
            : [startDate, endDate, startDate, endDate];
        const periodStats = await pool.query(statSql, fullStatParams);

        // 3) Calendar summary by day
        let calFrom = startDate;
        let calTo = endDate;
        if (cal_month && /^\d{4}-\d{2}$/.test(cal_month)) {
            calFrom = `${cal_month}-01`;
            calTo = `${cal_month}-31`;
        } else {
            const yyyymm = startDate.slice(0, 7);
            calFrom = `${yyyymm}-01`;
            calTo = `${yyyymm}-31`;
        }

        let calSql = `
            SELECT DATE_FORMAT(a.date, '%Y-%m-%d') AS date,
                   COALESCE(SUM(CASE WHEN a.status != 'absent' AND (a.check_in_status = 'on_time' OR (a.check_in_status IS NULL AND a.status IN ('on_time', 'early_leave'))) THEN 1 ELSE 0 END), 0) AS on_time,
                   COALESCE(SUM(CASE WHEN a.check_in_status = 'late' OR (a.check_in_status IS NULL AND a.status = 'late') THEN 1 ELSE 0 END), 0) AS late,
                   COALESCE(SUM(CASE WHEN a.check_out_status = 'early_leave' OR (a.check_out_status IS NULL AND a.status = 'early_leave') THEN 1 ELSE 0 END), 0) AS early_leave,
                   COALESCE(SUM(CASE WHEN a.status = 'absent' OR a.check_in_status = 'absent' THEN 1 ELSE 0 END), 0) AS absent,
                   COUNT(a.id) AS total
            FROM attendance a
            JOIN employees e ON e.id = a.employee_id
            WHERE a.date >= ? AND a.date <= ?
        `;
        const calParams = [calFrom, calTo];
        if (department_id) {
            calParams.push(parseInt(department_id, 10));
            calSql += ` AND e.department_id = ?`;
        }
        calSql += ` GROUP BY a.date ORDER BY a.date ASC`;
        const calRes = await pool.query(calSql, calParams);

        const calendarDays = {};
        for (const r of calRes.rows) {
            calendarDays[r.date] = r;
        }
        const statsRow = periodStats.rows[0];
        if (calendarDays[todayStr] && statsRow) {
            calendarDays[todayStr] = {
                ...calendarDays[todayStr],
                absent: statsRow.absent,
                total: statsRow.total
            };
        } else if (statsRow && statsRow.total > 0 && todayStr >= calFrom && todayStr <= calTo) {
            calendarDays[todayStr] = {
                date: todayStr,
                on_time: statsRow.on_time,
                late: statsRow.late,
                early_leave: statsRow.early_leave,
                absent: statsRow.absent,
                total: statsRow.total
            };
        }

        // 4) Filtered activities list
        let actSql = `
            SELECT * FROM (
                SELECT a.id, a.employee_id, e.employee_code, e.full_name,
                       d.name AS department_name, e.shift_name, e.work_start, e.work_end,
                       DATE_FORMAT(a.date, '%Y-%m-%d') AS date,
                       a.check_in, a.check_out, a.status,
                       a.check_in_status, a.check_out_status,
                       a.check_in_method, a.check_out_method,
                       a.confidence_in, a.confidence_out,
                       a.created_at
                FROM attendance a
                JOIN employees e ON e.id = a.employee_id
                LEFT JOIN departments d ON d.id = e.department_id
                WHERE a.date >= ? AND a.date <= ?
                ${department_id ? 'AND e.department_id = ?' : ''}
                UNION ALL
                SELECT NULL AS id, e.id AS employee_id, e.employee_code, e.full_name,
                       d.name AS department_name, e.shift_name, e.work_start, e.work_end,
                       DATE_FORMAT(?, '%Y-%m-%d') AS date,
                       NULL AS check_in, NULL AS check_out,
                       'absent' AS status,
                       'absent' AS check_in_status, NULL AS check_out_status,
                       'manual' AS check_in_method, NULL AS check_out_method,
                       NULL AS confidence_in, NULL AS confidence_out,
                       e.created_at
                FROM employees e
                LEFT JOIN departments d ON d.id = e.department_id
                WHERE e.status = 'active'
                ${department_id ? 'AND e.department_id = ?' : ''}
                AND NOT EXISTS (
                    SELECT 1 FROM attendance a
                    WHERE a.employee_id = e.id AND a.date >= ? AND a.date <= ?
                )
            ) all_act
            WHERE 1=1
        `;

        const actParams = department_id
            ? [startDate, endDate, parseInt(department_id, 10), endDate, parseInt(department_id, 10), startDate, endDate]
            : [startDate, endDate, endDate, startDate, endDate];

        if (status) {
            if (status === 'on_time') {
                actSql += ` AND (check_in_status = 'on_time' OR (check_in_status IS NULL AND status IN ('on_time', 'early_leave')))`;
            } else if (status === 'late') {
                actSql += ` AND (check_in_status = 'late' OR (check_in_status IS NULL AND status = 'late'))`;
            } else if (status === 'early_leave') {
                actSql += ` AND (check_out_status = 'early_leave' OR (check_out_status IS NULL AND status = 'early_leave'))`;
            } else if (status === 'absent') {
                actSql += ` AND (status = 'absent' OR check_in_status = 'absent')`;
            } else {
                actParams.push(status);
                actSql += ` AND status = ?`;
            }
        }
        if (search) {
            actParams.push(`%${search.trim()}%`);
            actParams.push(`%${search.trim()}%`);
            actSql += ` AND (full_name LIKE ? OR employee_code LIKE ?)`;
        }
        actSql += ` ORDER BY date DESC, COALESCE(check_out, check_in, created_at) DESC LIMIT 150`;
        const activities = await pool.query(actSql, actParams);

        return res.json({
            ok: true,
            data: {
                today: todayStr,
                filter: {
                    from: startDate,
                    to: endDate,
                    department_id: department_id || '',
                    status: status || '',
                    search: search || '',
                    cal_month: cal_month || startDate.slice(0, 7),
                },
                employees: empCount.rows[0],
                departments: deptCount.rows[0],
                today_stats: periodStats.rows[0],
                calendar_days: calendarDays,
                recent: activities.rows,
            },
        });
    } catch (err) {
        logger.error('dashboard overview', { err: err.message, stack: err.stack });
        return res.status(500).json({ ok: false, error: 'Failed to load dashboard: ' + err.message });
    }
}

module.exports = { overview };
