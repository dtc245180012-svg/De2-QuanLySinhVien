-- ============================================================================
-- De 27: He thong Diem danh / Attendance - Database Schema (MySQL 8.0)
-- MSSV: DTC245160039 - Email: dtc245160039@ictu.edu.vn
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- departments (Khoa / Lớp / Phòng ban)
-- ============================================================================
CREATE TABLE IF NOT EXISTS departments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- shifts (Ca làm việc / Ca học)
-- ============================================================================
CREATE TABLE IF NOT EXISTS shifts (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(128) NOT NULL UNIQUE,
    work_start  VARCHAR(8)   NOT NULL,
    work_end    VARCHAR(8)   NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- employees (Sinh viên / Nhân viên)
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
    (1, 'Khoa Công nghệ Thông tin', 'Đào tạo kỹ sư phần mềm, an toàn thông tin, mạng máy tính'),
    (2, 'Khoa Hệ thống Thông tin',   'Quản trị hệ thống, dữ liệu lớn, phân tích nghiệp vụ'),
    (3, 'Khoa Điện tử Truyền thông',  'IoT, phần cứng, viễn thông'),
    (4, 'Phòng Đào tạo & Quản lý SV', 'Quản lý lịch học, điểm danh, công tác sinh viên');

INSERT IGNORE INTO shifts (id, name, work_start, work_end) VALUES
    (1, 'Ca sáng (07:00 - 11:30)', '07:00', '11:30'),
    (2, 'Ca chiều (13:00 - 17:30)', '13:00', '17:30'),
    (3, 'Ca tối (18:00 - 21:00)', '18:00', '21:00');

INSERT IGNORE INTO employees (id, employee_code, full_name, email, phone, department_id, position, hire_date, status, work_start, work_end, shift_name) VALUES
    (1, 'SV001', 'Nguyễn Văn An',  'an.nv@ictu.edu.vn',   '0901000001', 1, 'Sinh viên Lớp CNTT K24', '2024-09-05', 'active', '07:00', '11:30', 'Ca sáng (07:00 - 11:30)'),
    (2, 'SV002', 'Trần Thị Bình',  'binh.tt@ictu.edu.vn', '0901000002', 1, 'Sinh viên Lớp CNTT K24', '2024-09-05', 'active', '07:00', '11:30', 'Ca sáng (07:00 - 11:30)'),
    (3, 'SV003', 'Lê Văn Cường',   'cuong.lv@ictu.edu.vn','0901000003', 2, 'Sinh viên Lớp HTTT K24', '2024-09-05', 'active', '07:00', '11:30', 'Ca sáng (07:00 - 11:30)'),
    (4, 'SV004', 'Phạm Thị Dung',  'dung.pt@ictu.edu.vn', '0901000004', 3, 'Sinh viên Lớp ĐTTT K24', '2024-09-05', 'active', '13:00', '17:30', 'Ca chiều (13:00 - 17:30)'),
    (5, 'SV005', 'Hoàng Văn Em',   'em.hv@ictu.edu.vn',   '0901000005', 1, 'Sinh viên Lớp CNTT K24', '2024-09-05', 'active', '07:00', '11:30', 'Ca sáng (07:00 - 11:30)');

-- Default accounts
-- admin: Admin@HRM2024!
-- hr01: Hr@HRM2024!
-- nv001: Nv@HRM2024!
-- chamcong: Chamcong@2024!
-- kiosk: Kiosk@2024!
INSERT INTO users (username, password_hash, role, employee_id) VALUES
    ('admin', '$2a$12$WdetURtFxQrIT0QVA9Y86OTFKX.98hwYL7fRMPJu7FD8Uc25jFA9u', 'admin',    NULL),
    ('hr01',  '$2a$12$l6H7VMTZBid.emrBa3IWU.5kSlrqOFb58wcC1PMcxAKAABvqX9xCu', 'hr',       2),
    ('nv001', '$2a$12$v1v5644HG6c..AP8bqsVTuXa0fPD2jTogN721hyIVCXZ.C10Hrigy', 'employee', 1),
    ('chamcong', '$2a$10$h3Ify4dymKq6ZzII/n8/OevQi1K6v2Bad8yOsTwsA.1P0lbNiuv7K', 'kiosk', NULL),
    ('kiosk',    '$2a$10$MbhvcR4m8QKTOz0EVF4vsOGOKcMM15LsUTznU6JXi/Igmn31WzuW2', 'kiosk', NULL)
ON DUPLICATE KEY UPDATE
    password_hash = VALUES(password_hash),
    role = VALUES(role),
    employee_id = VALUES(employee_id);
