// scripts/generate_seed_attendance.js
// Generates realistic attendance data for 118 students over the past 7 days and today using CURDATE()
const fs = require('fs');
const path = require('path');

function pad(n) { return n < 10 ? '0' + n : '' + n; }

let sql = `-- ============================================================================
-- Dữ liệu mẫu Điểm danh sinh viên (Báo cáo đề tài Đề 27)
-- Áp dụng động theo CURDATE() (Hôm nay và 7 ngày qua)
-- Cho 118 sinh viên thuộc 2 lớp KHMT K23A và KTPM K23A
-- ============================================================================

DELETE FROM attendance WHERE date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY);

INSERT INTO attendance (
    employee_id, date, check_in, check_out, 
    status, check_in_status, check_out_status, 
    check_in_method, check_out_method, 
    confidence_in, confidence_out, note
) VALUES
`;

const rows = [];

// Generate for days: 0 (today), 1, 2, 3, 4, 5, 6 days ago
const daysAgo = [0, 1, 2, 3, 4, 5, 6];

for (const d of daysAgo) {
    const dateExpr = d === 0 ? 'CURDATE()' : `DATE_SUB(CURDATE(), INTERVAL ${d} DAY)`;
    
    for (let empId = 1; empId <= 118; empId++) {
        // Pseudo-random deterministic based on empId and day
        const seed = (empId * 17 + d * 31) % 100;
        
        let status, checkInStatus, checkOutStatus, checkInMethod, checkOutMethod, confIn, confOut, note;
        let inTimeStr, outTimeStr;

        if (seed < 82) {
            // 82% On-time (Đúng giờ)
            status = 'on_time';
            checkInStatus = 'on_time';
            checkOutStatus = 'on_time';
            checkInMethod = seed % 3 === 0 ? 'manual' : 'face';
            checkOutMethod = seed % 4 === 0 ? 'manual' : 'face';
            confIn = (0.91 + (seed % 8) * 0.01).toFixed(4);
            confOut = (0.92 + (seed % 7) * 0.01).toFixed(4);
            
            const min = 45 + (seed % 14); // 06:45 - 06:58
            const sec = (seed * 3) % 60;
            inTimeStr = `'06:${pad(min)}:${pad(sec)}'`;
            outTimeStr = `'10:${pad(30 + (seed % 8))}:${pad((seed * 7) % 60)}'`;
            note = checkInMethod === 'manual' ? `'Giáo viên điểm danh theo lớp'` : `'Nhận diện khuôn mặt camera phòng học'`;
        } else if (seed < 91) {
            // 9% Late (Đi muộn)
            status = 'late';
            checkInStatus = 'late';
            checkOutStatus = 'on_time';
            checkInMethod = seed % 2 === 0 ? 'face' : 'manual';
            checkOutMethod = 'face';
            confIn = (0.88 + (seed % 6) * 0.01).toFixed(4);
            confOut = (0.90 + (seed % 8) * 0.01).toFixed(4);
            
            const min = 15 + (seed % 18); // 07:15 - 07:32
            inTimeStr = `'07:${pad(min)}:24'`;
            outTimeStr = `'10:30:45'`;
            note = `'Đi muộn ${min} phút'`;
        } else if (seed < 95) {
            // 4% Early leave (Về sớm)
            status = 'early_leave';
            checkInStatus = 'on_time';
            checkOutStatus = 'early_leave';
            checkInMethod = 'face';
            checkOutMethod = 'manual';
            confIn = '0.9450';
            confOut = null;
            inTimeStr = `'06:52:10'`;
            outTimeStr = `'10:05:00'`;
            note = `'Xin về sớm (Có giấy phép)'`;
        } else {
            // 5% Absent (Vắng mặt)
            status = 'absent';
            checkInStatus = 'absent';
            checkOutStatus = null;
            checkInMethod = 'manual';
            checkOutMethod = null;
            confIn = null;
            confOut = null;
            inTimeStr = null;
            outTimeStr = null;
            note = seed % 2 === 0 ? `'Vắng có phép'` : `'Vắng không phép'`;
        }

        const checkInExpr = inTimeStr ? `TIMESTAMP(${dateExpr}, ${inTimeStr})` : 'NULL';
        const checkOutExpr = outTimeStr ? `TIMESTAMP(${dateExpr}, ${outTimeStr})` : 'NULL';
        const checkOutStatusVal = checkOutStatus ? `'${checkOutStatus}'` : 'NULL';
        const checkOutMethodVal = checkOutMethod ? `'${checkOutMethod}'` : 'NULL';
        const confInVal = confIn ? `${confIn}` : 'NULL';
        const confOutVal = confOut ? `${confOut}` : 'NULL';

        rows.push(`    (${empId}, ${dateExpr}, ${checkInExpr}, ${checkOutExpr}, '${status}', '${checkInStatus}', ${checkOutStatusVal}, '${checkInMethod}', ${checkOutMethodVal}, ${confInVal}, ${confOutVal}, ${note})`);
    }
}

sql += rows.join(',\n') + ';\n';

const outPath = path.join(__dirname, '..', 'db', 'seed_attendance.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log(`Successfully generated ${rows.length} attendance records into ${outPath}`);
