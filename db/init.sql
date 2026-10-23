-- ============================================================================
-- De 27: He thong Diem danh / Attendance - Database Schema (MySQL 8.0)
-- MSSV: DTC245160039 - Email: dtc245160039@ictu.edu.vn
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- departments (Lớp học / Khoa đào tạo)
-- ============================================================================
CREATE TABLE IF NOT EXISTS departments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- shifts (Ca học / Tiết học sinh viên)
-- ============================================================================
CREATE TABLE IF NOT EXISTS shifts (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(128) NOT NULL UNIQUE,
    work_start  VARCHAR(8)   NOT NULL,
    work_end    VARCHAR(8)   NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- employees (Quản lý Sinh viên - Mã sinh viên MSSV)
-- ============================================================================
CREATE TABLE IF NOT EXISTS employees (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    employee_code     VARCHAR(32)  NOT NULL UNIQUE,
    full_name         VARCHAR(128) NOT NULL,
    email             VARCHAR(128) UNIQUE,
    phone             VARCHAR(20),
    department_id     INT,
    position          VARCHAR(64),
    hire_date         DATE,
    status            ENUM('active', 'terminated', 'on_leave') NOT NULL DEFAULT 'active',
    leave_start       DATE,
    leave_end         DATE,
    work_start        VARCHAR(8) NOT NULL DEFAULT '07:00',
    work_end          VARCHAR(8) NOT NULL DEFAULT '11:30',
    shift_name        VARCHAR(64) NOT NULL DEFAULT 'Ca sáng (07:00 - 11:30)',
    face_embedding    JSON,
    face_image_path   VARCHAR(255),
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_emp_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    INDEX idx_emp_dept (department_id),
    INDEX idx_emp_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- users (Tài khoản người dùng)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(64)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            ENUM('admin', 'hr', 'employee', 'kiosk') NOT NULL DEFAULT 'employee',
    employee_id     INT,
    is_active       TINYINT(1)   NOT NULL DEFAULT 1,
    last_login_at   DATETIME,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
    INDEX idx_users_employee_id (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- attendance (Lịch sử điểm danh)
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    employee_id       INT NOT NULL,
    date              DATE NOT NULL,
    check_in          DATETIME,
    check_out         DATETIME,
    status            ENUM('on_time', 'late', 'early_leave', 'absent') NOT NULL DEFAULT 'on_time',
    check_in_status   VARCHAR(32) DEFAULT 'on_time',
    check_out_status  VARCHAR(32),
    check_in_method   ENUM('face', 'manual') DEFAULT 'face',
    check_out_method  ENUM('face', 'manual'),
    confidence_in     DECIMAL(5,4),
    confidence_out    DECIMAL(5,4),
    note              TEXT,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_attendance_emp_date (employee_id, date),
    CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_attendance_date (date),
    INDEX idx_attendance_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- audit_log (Nhật ký hệ thống)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT,
    action      VARCHAR(64) NOT NULL,
    entity      VARCHAR(64) NOT NULL,
    entity_id   INT,
    payload     JSON,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- Seed data
-- ============================================================================
INSERT IGNORE INTO departments (id, name, description) VALUES
    (1, 'Lớp Khoa học Máy tính K23A (KHMT K23A)', 'Khóa 23 - Ngành Khoa học máy tính - Khoa CNTT ICTU'),
    (2, 'Lớp Kỹ thuật Phần mềm K23A (KTPM K23A)', 'Khóa 23 - Ngành Kỹ thuật phần mềm - Khoa CNTT ICTU'),
    (3, 'Lớp Công nghệ Thông tin K23B (CNTT K23B)', 'Khóa 23 - Ngành Công nghệ thông tin - Khoa CNTT ICTU'),
    (4, 'Ban Cán sự & Giáo vụ Quản lý Lớp', 'Điều phối giảng đường, thời khóa biểu và điểm danh sinh viên');

INSERT IGNORE INTO shifts (id, name, work_start, work_end) VALUES
    (1, 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)', '07:00', '10:30'),
    (2, 'Ca chiều (Tiết 7 - 10: 13:00 - 16:30)', '13:00', '16:30'),
    (3, 'Ca tối (Tiết 11 - 13: 18:00 - 20:30)', '18:00', '20:30');

INSERT IGNORE INTO employees (id, employee_code, full_name, email, phone, department_id, position, hire_date, status, work_start, work_end, shift_name) VALUES
    (1, 'DTC245160039', 'Đàm Đức Lương', 'dtc245160039@ictu.edu.vn', '0980000001', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (2, 'DTC245160009', 'Nông Hoàng Nhật Anh', 'dtc245160009@ictu.edu.vn', '0980000002', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (3, 'DTC245160018', 'Nguyễn Tuấn Anh', 'dtc245160018@ictu.edu.vn', '0980000003', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (4, 'DTC245160003', 'Trương Hồng Anh', 'dtc245160003@ictu.edu.vn', '0980000004', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (5, 'DTC245160056', 'Nguyễn Tuấn Anh', 'dtc245160056@ictu.edu.vn', '0980000005', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (6, 'DTC245160050', 'Lê Nguyễn Đức Anh', 'dtc245160050@ictu.edu.vn', '0980000006', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (7, 'DTC245310300', 'Dương Thị Ngọc Ánh', 'dtc245310300@ictu.edu.vn', '0980000007', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (8, 'DTC245160033', 'Ngô Xuân Cương', 'dtc245160033@ictu.edu.vn', '0980000008', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (9, 'DTC245160045', 'Tạ Văn Chiến', 'dtc245160045@ictu.edu.vn', '0980000009', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (10, 'DTC245200775', 'Đặng Quốc Doanh', 'dtc245200775@ictu.edu.vn', '0980000010', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (11, 'DTC245160034', 'Nguyễn Tấn Dũng', 'dtc245160034@ictu.edu.vn', '0980000011', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (12, 'DTC245160020', 'Trần Mạnh Dũng', 'dtc245160020@ictu.edu.vn', '0980000012', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (13, 'DTC245160029', 'Hoàng Đức Dương', 'dtc245160029@ictu.edu.vn', '0980000013', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (14, 'DTC245090046', 'Bùi Văn Đạt', 'dtc245090046@ictu.edu.vn', '0980000014', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (15, 'DTC245160048', 'Trần Thị Điệp', 'dtc245160048@ictu.edu.vn', '0980000015', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (16, 'DTC245160004', 'Lê Văn Đức', 'dtc245160004@ictu.edu.vn', '0980000016', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (17, 'DTC245160015', 'Nguyễn Văn Trường Giang', 'dtc245160015@ictu.edu.vn', '0980000017', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (18, 'DTC245160026', 'Hoàng Văn Hà', 'dtc245160026@ictu.edu.vn', '0980000018', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (19, 'DTC245160010', 'Vũ Thị Hà', 'dtc245160010@ictu.edu.vn', '0980000019', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (20, 'DTC245220009', 'Nguyễn Hoàng Hải', 'dtc245220009@ictu.edu.vn', '0980000020', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (21, 'DTC245160055', 'Nguyễn Đức Hiếu', 'dtc245160055@ictu.edu.vn', '0980000021', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (22, 'DTC245160021', 'Bành Trung Hiếu', 'dtc245160021@ictu.edu.vn', '0980000022', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (23, 'DTC245280015', 'Nguyễn Thị Khánh Hòa', 'dtc245280015@ictu.edu.vn', '0980000023', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (24, 'DTC245160041', 'Phạm Văn Học', 'dtc245160041@ictu.edu.vn', '0980000024', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (25, 'DTC245160057', 'Nguyễn Văn Huy', 'dtc245160057@ictu.edu.vn', '0980000025', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (26, 'DTC245160053', 'Hà Quang Huy', 'dtc245160053@ictu.edu.vn', '0980000026', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (27, 'DTC245160044', 'Lưu Thanh Huyền', 'dtc245160044@ictu.edu.vn', '0980000027', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (28, 'DTC245160037', 'Hà Duy Hưng', 'dtc245160037@ictu.edu.vn', '0980000028', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (29, 'DTC245200001', 'Trần Thị Lan Hương', 'dtc245200001@ictu.edu.vn', '0980000029', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (30, 'DTC245160002', 'Lưu Quỳnh Kiên', 'dtc245160002@ictu.edu.vn', '0980000030', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (31, 'DTC245200003', 'Mưu Tuấn Khải', 'dtc245200003@ictu.edu.vn', '0980000031', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (32, 'DTC245160008', 'Chu Thị Ngọc Lan', 'dtc245160008@ictu.edu.vn', '0980000032', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (33, 'DTC245160036', 'Đỗ Tùng Lâm', 'dtc245160036@ictu.edu.vn', '0980000033', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (34, 'DTC245160013', 'Vũ Bảo Linh', 'dtc245160013@ictu.edu.vn', '0980000034', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (35, 'DTC245200055', 'Lương Thị Thùy Linh', 'dtc245200055@ictu.edu.vn', '0980000035', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (36, 'DTC245160023', 'Lê Phương Mai', 'dtc245160023@ictu.edu.vn', '0980000036', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (37, 'DTC245160017', 'Ngô Quang Minh', 'dtc245160017@ictu.edu.vn', '0980000037', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (38, 'DTC245160014', 'Lương Nguyễn Hoàng Nam', 'dtc245160014@ictu.edu.vn', '0980000038', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (39, 'DTC245160065', 'Vũ Nguyễn Giang Nam', 'dtc245160065@ictu.edu.vn', '0980000039', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (40, 'DTC245160032', 'Nguyễn Tiến Nam', 'dtc245160032@ictu.edu.vn', '0980000040', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (41, 'DTC245160049', 'Lê Bình Nguyên', 'dtc245160049@ictu.edu.vn', '0980000041', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (42, 'DTC245160006', 'Phạm Thị Nhung', 'dtc245160006@ictu.edu.vn', '0980000042', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (43, 'DTC245160012', 'Nông Anh Quân', 'dtc245160012@ictu.edu.vn', '0980000043', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (44, 'DTC245160024', 'Tô Văn Quyền', 'dtc245160024@ictu.edu.vn', '0980000044', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (45, 'DTC245200235', 'Nguyễn Văn Sáng', 'dtc245200235@ictu.edu.vn', '0980000045', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (46, 'DTC235160047', 'Vũ Hồng Sơn', 'dtc235160047@ictu.edu.vn', '0980000046', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (47, 'DTC245160061', 'Vũ Ngọc Sơn', 'dtc245160061@ictu.edu.vn', '0980000047', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (48, 'DTC245200269', 'Phạm Ngọc Sơn', 'dtc245200269@ictu.edu.vn', '0980000048', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (49, 'DTC245160042', 'Hoàng Công Sự', 'dtc245160042@ictu.edu.vn', '0980000049', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (50, 'DTC245160031', 'Nguyễn Thế Tài', 'dtc245160031@ictu.edu.vn', '0980000050', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (51, 'DTC245160059', 'hà quang tiến', 'dtc245160059@ictu.edu.vn', '0980000051', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (52, 'DTC245160064', 'Nông Anh Tú', 'dtc245160064@ictu.edu.vn', '0980000052', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (53, 'DTC245160007', 'Hoàng Minh Tuất', 'dtc245160007@ictu.edu.vn', '0980000053', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (54, 'DTC245160058', 'Vũ Trọng Tuyền', 'dtc245160058@ictu.edu.vn', '0980000054', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (55, 'DTC245160005', 'Ma Đình Tuyển', 'dtc245160005@ictu.edu.vn', '0980000055', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (56, 'DTC245160062', 'Phạm Thị Ánh Tuyết', 'dtc245160062@ictu.edu.vn', '0980000056', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (57, 'DTC245190003', 'Dương Thu Trang', 'dtc245190003@ictu.edu.vn', '0980000057', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (58, 'DTC245160011', 'Nguyễn Thùy Trang', 'dtc245160011@ictu.edu.vn', '0980000058', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (59, 'DTC245160028', 'Lục Thanh Trọng', 'dtc245160028@ictu.edu.vn', '0980000059', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (60, 'DTC245160025', 'Nguyễn Văn Trường', 'dtc245160025@ictu.edu.vn', '0980000060', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (61, 'DTC245160035', 'Hoàng Ninh Quốc Việt', 'dtc245160035@ictu.edu.vn', '0980000061', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (62, 'DTC245160040', 'Giang Hoàng Việt', 'dtc245160040@ictu.edu.vn', '0980000062', 1, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (63, 'DTC245180148', 'Nguyễn Quốc Anh', 'dtc245180148@ictu.edu.vn', '0980000063', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (64, 'DTC245290012', 'Hoàng Hải Anh', 'dtc245290012@ictu.edu.vn', '0980000064', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (65, 'DTC245180077', 'Nguyễn Quốc Bảo', 'dtc245180077@ictu.edu.vn', '0980000065', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (66, 'DTC245180081', 'Bùi Ngọc Bình', 'dtc245180081@ictu.edu.vn', '0980000066', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (67, 'DTC245180016', 'Hà Thị Mỹ Bình', 'dtc245180016@ictu.edu.vn', '0980000067', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (68, 'DTC245180164', 'Phạm Thanh Bình', 'dtc245180164@ictu.edu.vn', '0980000068', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (69, 'DTC245180063', 'Cao Xuân Chiến', 'dtc245180063@ictu.edu.vn', '0980000069', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (70, 'DTC245180087', 'Nguyễn Duy Chiến', 'dtc245180087@ictu.edu.vn', '0980000070', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (71, 'DTC245180120', 'Dương Văn Chuẩn', 'dtc245180120@ictu.edu.vn', '0980000071', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (72, 'DTC245180144', 'Dương Hải Dương', 'dtc245180144@ictu.edu.vn', '0980000072', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (73, 'DTC245180142', 'Hoàng Đình Gia Đạt', 'dtc245180142@ictu.edu.vn', '0980000073', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (74, 'DTC245200154', 'Mai Văn Đạt', 'dtc245200154@ictu.edu.vn', '0980000074', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (75, 'DTC245180004', 'Hoàng Tiến Đạt', 'dtc245180004@ictu.edu.vn', '0980000075', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (76, 'DTC245180147', 'Nguyễn Thành Đạt', 'dtc245180147@ictu.edu.vn', '0980000076', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (77, 'DTC245180128', 'Cao Tiến Đạt', 'dtc245180128@ictu.edu.vn', '0980000077', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (78, 'DTC245200172', 'Nông Tiến Đạt', 'dtc245200172@ictu.edu.vn', '0980000078', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (79, 'DTC245310198', 'Nguyễn Hải Đăng', 'dtc245310198@ictu.edu.vn', '0980000079', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (80, 'DTC245180127', 'Nguyễn Việt Đức', 'dtc245180127@ictu.edu.vn', '0980000080', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (81, 'DTC245180168', 'Nguyễn Thị Giang', 'dtc245180168@ictu.edu.vn', '0980000081', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (82, 'DTC245180180', 'Trương Đình Giang', 'dtc245180180@ictu.edu.vn', '0980000082', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (83, 'DTC245180096', 'Ngọ Quang Hải', 'dtc245180096@ictu.edu.vn', '0980000083', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (84, 'DTC245180059', 'Nguyễn Văn Hải', 'dtc245180059@ictu.edu.vn', '0980000084', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (85, 'DTC245180010', 'Nguyễn Hồng Hải', 'dtc245180010@ictu.edu.vn', '0980000085', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (86, 'DTC245180011', 'Diệp Đình Hân', 'dtc245180011@ictu.edu.vn', '0980000086', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (87, 'DTC245180095', 'Phan Lê Hoàng', 'dtc245180095@ictu.edu.vn', '0980000087', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (88, 'DTC245180001', 'Bùi Ngọc Huân', 'dtc245180001@ictu.edu.vn', '0980000088', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (89, 'DTC245180054', 'Hoàng Thanh Hùng', 'dtc245180054@ictu.edu.vn', '0980000089', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (90, 'DTC245180108', 'Dương Tuấn Huy', 'dtc245180108@ictu.edu.vn', '0980000090', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (91, 'DTC245180069', 'Nguyễn Thành Hưng', 'dtc245180069@ictu.edu.vn', '0980000091', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (92, 'DTC245180049', 'Dương Minh Hưng', 'dtc245180049@ictu.edu.vn', '0980000092', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (93, 'DTC245180065', 'Phạm Hải Hướng', 'dtc245180065@ictu.edu.vn', '0980000093', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (94, 'DTC245180012', 'Ngô Hoàng Lan', 'dtc245180012@ictu.edu.vn', '0980000094', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (95, 'DTC245180092', 'Trần Khánh Liêm', 'dtc245180092@ictu.edu.vn', '0980000095', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (96, 'DTC245180034', 'Nguyễn Tuấn Lực', 'dtc245180034@ictu.edu.vn', '0980000096', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (97, 'DTC245180041', 'Nguyễn Ngọc Lương', 'dtc245180041@ictu.edu.vn', '0980000097', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (98, 'DTC245180071', 'Bùi Hải Nam', 'dtc245180071@ictu.edu.vn', '0980000098', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (99, 'DTC245030038', 'Đinh Khôi Nguyên', 'dtc245030038@ictu.edu.vn', '0980000099', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (100, 'DTC245180153', 'Lê Minh Quân', 'dtc245180153@ictu.edu.vn', '0980000100', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (101, 'DTC245180140', 'Vi Hoàng Quân', 'dtc245180140@ictu.edu.vn', '0980000101', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (102, 'DTC245350005', 'Trần Khả Quân', 'dtc245350005@ictu.edu.vn', '0980000102', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (103, 'DTC245180188', 'Đàm Khánh Toàn', 'dtc245180188@ictu.edu.vn', '0980000103', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (104, 'DTC245180032', 'Tô Quang Tú', 'dtc245180032@ictu.edu.vn', '0980000104', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (105, 'DTC245180118', 'La Văn Tuấn', 'dtc245180118@ictu.edu.vn', '0980000105', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (106, 'DTC245180149', 'Lường Thanh Tùng', 'dtc245180149@ictu.edu.vn', '0980000106', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (107, 'DTC245180039', 'Đồng Văn Tuyên', 'dtc245180039@ictu.edu.vn', '0980000107', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (108, 'DTC245180018', 'Nguyễn Ngọc Thắng', 'dtc245180018@ictu.edu.vn', '0980000108', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (109, 'DTC245180126', 'Hứa Quốc Thắng', 'dtc245180126@ictu.edu.vn', '0980000109', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (110, 'DTC245180170', 'Trần Minh Thuận', 'dtc245180170@ictu.edu.vn', '0980000110', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (111, 'DTC245180005', 'Lý Văn Thuận', 'dtc245180005@ictu.edu.vn', '0980000111', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (112, 'DTC245180047', 'Bùi Phương Thúy', 'dtc245180047@ictu.edu.vn', '0980000112', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (113, 'DTC245180067', 'Nguyễn Thị Thu Trà', 'dtc245180067@ictu.edu.vn', '0980000113', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (114, 'DTC245180145', 'Nguyễn Thị Huyền Trang', 'dtc245180145@ictu.edu.vn', '0980000114', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (115, 'DTC245180122', 'Đỗ Kiên Trung', 'dtc245180122@ictu.edu.vn', '0980000115', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (116, 'DTC245200080', 'Nguyễn Thị Hồng Vân', 'dtc245200080@ictu.edu.vn', '0980000116', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (117, 'DTC245180064', 'Nguyễn Quốc Việt', 'dtc245180064@ictu.edu.vn', '0980000117', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)'),
    (118, 'DTC245160027', 'Nguyễn Văn Vũ', 'dtc245160027@ictu.edu.vn', '0980000118', 2, 'Sinh viên', '2023-09-05', 'active', '07:00', '10:30', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)');

-- Default accounts
-- admin: Admin@Attendance2024!
-- giaovu / hr01: Giaovu@2024!
-- dtc245160039: Dtc245160039@2024!
-- sv001: Sv@2024!
-- chamcong / kiosk: Chamcong@2024!
INSERT INTO users (username, password_hash, role, employee_id) VALUES
    ('admin',        '$2b$12$fl59T8rlpijMi1maVzfjoe07cO88Rw4SlMjj.c4sEbF18RppP09Am', 'admin',    NULL),
    ('giaovu',       '$2b$12$IUvOS1fzW5QvIaA2lBmVNeH4Uk5co5RKfhfmFatKcxYruNTLX5WN.', 'hr',       NULL),
    ('hr01',         '$2b$12$IUvOS1fzW5QvIaA2lBmVNeH4Uk5co5RKfhfmFatKcxYruNTLX5WN.', 'hr',       NULL),
    ('dtc245160039', '$2b$12$4OaUAEAOUxEeQiaXnp0xpeJdWj2yvU/HA7zlc0n15Ml9sgrYN/Pwq', 'employee', 1),
    ('dtc245180148', '$2b$12$y6uwbBnlRadPtkRdAjXg8OC1/Y4gRe5FI7Gz9D2SyFZPiN2GxReCm', 'employee', 63),
    ('sv001',        '$2b$12$C202Vb7I32DlQC/515gi0.nXFBm1vB5Q9a3vXgQru0.ofNUimtzoC', 'employee', 2),
    ('chamcong',     '$2b$12$qfuyJdDGfXaNUaz7/XjO9OeO2UCj7bc4CA6re4LJYuee3FqFGtjIy', 'kiosk',    NULL),
    ('kiosk',        '$2b$12$r0XWnbIF8tgQCrLWQIdyaOL2icobwecqUrHsnoqg1efJbYhRvQq5u', 'kiosk',    NULL)
ON DUPLICATE KEY UPDATE
    password_hash = VALUES(password_hash),
    role = VALUES(role),
    employee_id = VALUES(employee_id);
