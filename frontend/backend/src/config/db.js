// src/config/db.js - MySQL connection pool & compatibility layer
'use strict';

const mysql = require('mysql2/promise');
const { logger } = require('./logger');

const rawPool = mysql.createPool({
    host:             process.env.MYSQL_HOST     || 'db',
    port:             parseInt(process.env.MYSQL_PORT || '3306', 10),
    database:         process.env.MYSQL_DATABASE || 'attendance_db',
    user:             process.env.MYSQL_USER     || 'attendance_user',
    password:         process.env.MYSQL_PASSWORD || 'ChangeMe_MySQL_2024!_mY8s',
    waitForConnections: true,
    connectionLimit:  20,
    queueLimit:       0,
    dateStrings:      true,
    charset:          'utf8mb4',
});

rawPool.on('error', (err) => logger.error('MySQL pool error', { err: err.message }));

/**
 * Compatibility wrapper around MySQL pool:
 * - Automatically converts PostgreSQL-style placeholders ($1, $2, ...) to MySQL (?)
 * - Returns { rows, rowCount, insertId }
 */
const pool = {
    async query(sql, params = []) {
        // Convert $1, $2, ... to ?
        let convertedSql = sql;
        let convertedParams = Array.isArray(params) ? [...params] : [];

        if (/\$\d+/.test(convertedSql)) {
            // Check if there are positional parameters like $1, $2
            // Replace $N with the corresponding index in params
            const matches = convertedSql.match(/\$(\d+)/g);
            if (matches) {
                // If the query references $1, $2 in order or multiple times
                const newParams = [];
                convertedSql = convertedSql.replace(/\$(\d+)/g, (_, num) => {
                    const idx = parseInt(num, 10) - 1;
                    newParams.push(params[idx]);
                    return '?';
                });
                convertedParams = newParams;
            }
        }

        // Clean any PostgreSQL type casts like ::date, ::int, ::text, ::vector
        convertedSql = convertedSql.replace(/::[a-zA-Z0-9_]+/g, '');

        // Execute query on MySQL pool
        const [results, fields] = await rawPool.query(convertedSql, convertedParams);

        if (Array.isArray(results)) {
            return {
                rows: results,
                rowCount: results.length,
                insertId: null,
            };
        } else {
            return {
                rows: [results],
                rowCount: results.affectedRows,
                insertId: results.insertId,
            };
        }
    },

    async end() {
        return rawPool.end();
    }
};

async function checkDb(retries = 30, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            const r = await pool.query('SELECT 1 AS ok, NOW() AS ts');
            logger.info('MySQL DB healthcheck ok', { ts: r.rows[0].ts });
            return;
        } catch (err) {
            logger.warn(`MySQL DB not ready (try ${i + 1}/${retries}): ${err.message}`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw new Error('MySQL Database unreachable');
}

/**
 * Calculate Cosine Distance between two 512-d float vectors:
 * distance = 1 - (A . B) / (||A|| * ||B||)
 * Returns a value in [0, 2], where 0 means identical.
 */
function cosineDistance(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 1.0;
    let dot = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        const a = vecA[i];
        const b = vecB[i];
        dot += a * b;
        normA += a * a;
        normB += b * b;
    }
    if (normA === 0 || normB === 0) return 1.0;
    const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    return 1.0 - similarity;
}

function toVectorLiteral(arr) {
    if (!Array.isArray(arr)) throw new Error('Embedding must be array');
    return JSON.stringify(arr);
}

module.exports = { pool, checkDb, cosineDistance, toVectorLiteral };
