# Đề 27: Hệ thống Điểm danh Sinh viên / Student Attendance System

> **Môn học:** Triển khai và Quản trị Hệ thống Phần mềm  
> **Đề tài:** Đề 27 — Hệ thống Điểm danh Sinh viên (Trường ĐH CNTT & Truyền thông - ICTU)  
> **Sinh viên thực hiện:** DTC245160039  
> **Email:** dtc245160039@ictu.edu.vn  
> **GitHub:** [dtc245160039-max/dtc245160039-De27-HeThongDiemDanh](https://github.com/dtc245160039-max/dtc245160039-De27-HeThongDiemDanh)  

Hệ thống điểm danh sinh viên theo ca học/tiết học, lịch sử điểm danh và thống kê chuyên sâu. Tích hợp đầy đủ:

- ✅ **Ứng dụng web điểm danh**: Frontend HTML/CSS/JS + Backend API Node.js Express + AI Face Matching
- ✅ **Cơ sở dữ liệu**: MySQL 8.0 + Công cụ quản trị web **phpMyAdmin**
- ✅ **Nginx Reverse Proxy**: HTTPS tự ký + 6 Security Headers (HSTS, CSP, X-Frame-Options, XSS, NoSniff, Permissions)
- ✅ **Hệ thống giám sát Prometheus + Grafana**: Container (cAdvisor), Host (Node Exporter), Web API (attendance-backend), Database (**mysqld-exporter**)
- ✅ **Hệ thống log tập trung Loki + Promtail**: Promtail scrape JSON logs, trực quan hóa Grafana, 3 câu truy vấn LogQL mẫu
- ✅ **Hardening toàn diện**: Non-root container, 3 mạng bridge cô lập, mật khẩu mạnh bcrypt cost 12, rate-limiting, least-privilege

---

## 🏗️ Kiến trúc Hệ thống

```
                    ┌──────────────────────────┐
                    │     Nginx (:80/:443)     │  Reverse proxy + TLS self-signed
                    │    6 Security Headers    │
                    └──────────┬───────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
  ┌────────────┐         ┌────────────┐         ┌────────────┐
  │  Frontend  │         │  Backend   │         │ phpMyAdmin │
  │  (Nginx)   │         │  Node.js   │         │  (Web GUI) │
  │  :8080     │         │  :3000     │         │  :80       │
  └────────────┘         └─────┬──────┘         └────────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │    MySQL 8.0     │  attendance_db
                      │   (InnoDB CSDL)  │  Face vector (JSON)
                      │      :3306       │
                      └──────────────────┘
```

### 3 Network Bridge cô lập:
- `attendance_frontend_net`: proxy ↔ frontend, proxy ↔ backend, proxy ↔ phpmyadmin
- `attendance_backend_net`: backend ↔ db, phpmyadmin ↔ db, mysqld-exporter ↔ db (Cô lập CSDL không mở cổng ra ngoài)
- `attendance_monitor_net`: prometheus, grafana, loki, promtail, node-exporter, cadvisor, mysqld-exporter

---

## 🚀 Cài đặt & Khởi động nhanh

### Yêu cầu hệ thống
- Docker Engine 24+ & Docker Compose v2
- Tối thiểu 4 GB RAM & 10 GB ổ cứng trống

### Bước 1 — Chuẩn bị môi trường & Sinh chứng chỉ SSL
```bash
git clone https://github.com/dtc245160039-max/dtc245160039-De27-HeThongDiemDanh.git
cd dtc245160039-De27-HeThongDiemDanh
cp .env.example .env
bash scripts/gen-certs.sh
```

### Bước 2 — Khởi động stack ứng dụng chính
```bash
docker compose up -d --build
```
Stack chính gồm: `db` (MySQL 8.0), `phpmyadmin`, `backend` (Node.js), `frontend`, `proxy` (Nginx).

### Bước 3 — Khởi động stack Giám sát & Ghi log tập trung
```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```
Stack giám sát gồm: `attendance_prometheus`, `attendance_grafana`, `attendance_loki`, `attendance_promtail`, `attendance_node_exporter`, `attendance_cadvisor`, `attendance_mysqld_exporter`.

---

## 🌐 Danh mục URL & Tài khoản Hệ thống

| Phân hệ / Dịch vụ | URL truy cập | Tài khoản / Mật khẩu | Mục đích sử dụng |
|---|---|---|---|
| **Reverse Proxy Chính** | **https://localhost** | — | HTTPS an toàn, phục vụ điểm danh và quản trị |
| **Frontend Trực tiếp** | http://localhost:8080 | — | Truy cập giao diện trực tiếp (tuỳ chọn) |
| **phpMyAdmin** | **https://localhost/phpmyadmin/** | `attendance_user` / `ChangeMe_MySQL_2024!_mY8s`<br>*(hoặc root: `RootPassword_Secure_2024!_rT9p`)* | Quản trị CSDL MySQL trên nền Web |
| **Prometheus** | http://localhost:9090 | — | Bảng điều khiển kiểm tra các target giám sát |
| **Grafana** | http://localhost:3001 | `admin` / `ChangeMe_Grafana_2024!_gR5t` | Dashboard giám sát và tra cứu LogQL |
| **Loki API** | http://localhost:3100 | — | API lưu trữ log tập trung |

### Danh sách tài khoản người dùng ứng dụng:

| Vai trò | Username | Password | Quyền hạn / Mục đích |
|---|---|---|---|
| **Quản trị viên (Admin)** | `admin` | `Admin@Attendance2024!` | Toàn quyền quản lý sinh viên, Lớp học/Khoa, Ca học, xem thống kê |
| **Giáo vụ Quản lý Lớp (HR)** | `hr01` (hoặc `giaovu`) | `Hr@Attendance2024!` *(hoặc `Giaovu@2024!`)* | Quản lý danh sách sinh viên, điểm danh, phân ca học |
| **Sinh viên (SV)** | `dtc245160039` *(KHMT K23A)*<br>`dtc245180148` *(KTPM K23A)*<br>`sv001` | `Dtc245160039@2024!`<br>`Dtc245180148@2024!`<br>`Sv@2024!` | Xem lịch sử điểm danh của cá nhân từng sinh viên theo lớp học |
| **Máy Điểm Danh (Kiosk)** | `chamcong` *(hoặc `kiosk`)* | `Chamcong@2024!` *(hoặc `Kiosk@2024!`)* | **Chuyên dụng cho máy điểm danh tại cửa lớp học**. Tự động mở camera điểm danh, khóa toàn bộ trang quản trị |

---

## ✨ Các tính năng nổi bật của hệ thống

1. **Điểm danh tự động qua Camera / Webcam**:
   - Sử dụng Cosine Distance đối chiếu vector đặc trưng khuôn mặt 512D với dữ liệu sinh viên trong MySQL.
   - Tự động xác định trạng thái: `Đúng giờ` (on_time), `Đi muộn` (late), `Về sớm` (early_leave), `Vắng mặt` (absent).
2. **Quản lý Sinh viên & Lớp học / Khoa**: Thêm mới, chụp ảnh đăng ký khuôn mặt, chỉnh sửa thông tin, phân lớp, **nhập danh sách từ Excel (.xlsx, .csv)**.
3. **Quản lý Ca học / Tiết học (Shifts)**:
   - Ca chuẩn: Ca sáng (Tiết 1 - 4: 07:00 - 10:30), Ca chiều (Tiết 7 - 10: 13:00 - 16:30), Ca tối (Tiết 11 - 13: 18:00 - 20:30).
   - Cho phép thêm ca tùy chỉnh và phân ca hàng loạt cho sinh viên.
4. **Quản lý Nghỉ phép (Leave Management)**:
   - Đăng ký nghỉ có thời hạn; background cron tự động cập nhật trạng thái khi hết hạn nghỉ.
5. **Chế độ Kiosk An toàn (Dedicated Kiosk Guard)**:
   - Tài khoản `chamcong` chỉ hiển thị giao diện camera quẹt mặt, ẩn hoàn toàn menu quản trị, tự động chặn mọi nỗ lực truy cập trang khác (mã 403 Forbidden).
6. **Dashboard Thống kê Thời gian thực**:
   - Biểu đồ tròn và thẻ thống kê tỷ lệ Đúng giờ, Đi muộn, Vắng mặt; lọc nhanh danh sách sinh viên theo từng tiêu chí.

---

## 📊 Giám sát & Ghi log tập trung

### Prometheus Targets (http://localhost:9090/targets)
Đảm bảo 4 target đều ở trạng thái **UP**:
- `attendance-backend`: Node.js metrics (request count, latency)
- `node-exporter`: CPU, RAM, Disk, Network máy chủ
- `cadvisor`: Tài nguyên từng container Docker
- `mysqld-exporter`: Hiệu năng CSDL MySQL 8.0 (connections, buffer pool, queries)

### Grafana Dashboard (http://localhost:3001)
Vào **Dashboards** → mở **"Attendance - System Overview"** gồm 6 panel:
1. Container CPU Usage (cAdvisor)
2. Container Memory Usage (cAdvisor)
3. MySQL Threads Connected (mysqld-exporter)
4. MySQL Uptime (mysqld-exporter)
5. Recent Backend Errors (Loki logs)
6. Host Disk Space Usage % (Node Exporter)

### 3 Câu truy vấn LogQL mẫu (Thực hiện trên Grafana → Explore → Loki):

1. **Lọc các lượt đăng nhập thành công vào hệ thống:**
   ```logql
   {compose_service="backend"} |= "Login success"
   ```

2. **Lọc nhật ký các lần điểm danh bằng khuôn mặt:**
   ```logql
   {compose_service="backend"} |= "face_check"
   ```

3. **Bóc tách JSON log và lọc toàn bộ lỗi hệ thống (Level error):**
   ```logql
   {compose_service="backend"} | json | level="error"
   ```

---

## 🔐 Các biện pháp Hardening bảo mật

| # | Biện pháp | Triển khai cụ thể |
|---|---|---|
| 1 | **Non-root container** | `Dockerfile` và compose chạy dưới user unprivileged (`1001:1001`, `65534:65534`, `472:472`) |
| 2 | **Network isolation** | 3 bridge networks: `attendance_frontend_net`, `attendance_backend_net`, `attendance_monitor_net` |
| 3 | **Mật khẩu mạnh & Hashing** | Bcrypt cost 12 cho tài khoản, mật khẩu CSDL phức tạp (> 16 ký tự có chữ hoa, số, ký tự đặc biệt) |
| 4 | **Security Headers Nginx** | 6 header bắt buộc: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy |
| 5 | **Rate limiting** | Nginx giới hạn 10 r/s (burst 20) + Express rate-limiter bảo vệ API login và face-check |
| 6 | **HTTPS tự ký (TLS 1.2/1.3)** | Nginx reverse proxy mã hóa toàn bộ dữ liệu truyền nhận, script `gen-certs.sh` hỗ trợ SAN IP |
| 7 | **SQL Injection prevention** | 100% truy vấn MySQL sử dụng Parameterized Query `mysql2/promise` |
| 8 | **XSS & Injection Protection** | Helmet HTTP security, sanitization dữ liệu đầu vào |
| 9 | **File upload validation** | Multer chỉ cho phép định dạng ảnh (jpg, jpeg, png, webp) với dung lượng tối đa 5MB |
| 10 | **Least-privilege security_opt** | Áp dụng `no-new-privileges:true` trên toàn bộ container |
| 11 | **Resource limits** | Giới hạn trần RAM và CPU cho từng container để phòng ngừa tấn công DoS tài nguyên |
| 12 | **Kiosk Guard** | RBAC phân quyền chặt chẽ, chặn triệt để máy điểm danh truy cập dữ liệu quản trị |

---

## 🗂️ Cấu trúc Thư mục Dự án

```
dtc245160039-De27-HeThongDiemDanh/
├── README.md                               # Tài liệu tổng quan dự án
├── Huong_Dan_Trien_Khai_Ubuntu_Server.md   # Hướng dẫn chi tiết triển khai máy ảo Ubuntu
├── Bao_Cao_Tong_Hop_De27.md                # Báo cáo tổng hợp môn học (≥ 10 trang)
├── docker-compose.yml                      # Stack ứng dụng: MySQL 8, phpMyAdmin, Backend, Frontend, Proxy
├── docker-compose.monitoring.yml           # Stack giám sát: Prometheus, Grafana, Loki, Promtail, Exporters
├── .env.example                            # Biến môi trường mẫu
├── openssl.cnf                             # Cấu hình sinh SSL certificate có SAN IP
├── db/
│   └── init.sql                            # Schema MySQL 8.0, cấu trúc bảng và seed data mẫu
├── backend/                                # Node.js Express Backend RESTful API
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── src/                                # Controllers, Routes, Middleware, DB Pool
├── frontend/                               # Giao diện web tĩnh HTML/CSS/Vanilla JS
│   ├── Dockerfile
│   ├── nginx-frontend.conf
│   ├── index.html, login.html, attendance.html, dashboard.html, employees.html, shifts.html...
│   ├── css/
│   └── js/
├── nginx/                                  # Nginx Reverse Proxy
│   ├── nginx-proxy.conf                    # HTTPS, 6 Security Headers, Proxy pass
│   └── certs/                              # Chứng chỉ cert.pem và key.pem
├── monitoring/
│   ├── prometheus/                         # prometheus.yml, alerts.yml
│   ├── grafana/                            # dashboards, provisioning
│   ├── loki/                               # loki-config.yml
│   └── promtail/                           # promtail-config.yml
└── scripts/
    ├── gen-certs.sh                        # Script sinh SSL tự ký
    ├── backup_db.sh                        # Script tự động sao lưu MySQL
    └── seed_faces.py                       # Script nạp dữ liệu khuôn mặt mẫu
```

---

## 📋 Kế hoạch 3 Commit Git (Chuẩn Tiêu chí 1 - Thang điểm Đề 27)

| # | Commit Message | Nội dung tương ứng |
|---|---|---|
| **1** | `feat(core): initial Attendance application stack, MySQL 8.0, phpMyAdmin and Nginx reverse proxy with SSL` | Toàn bộ mã nguồn web, API backend Node.js, CSDL MySQL 8.0 (init.sql), phpMyAdmin và cấu hình Nginx HTTPS. |
| **2** | `feat(monitoring): integrate Prometheus and Grafana dashboards with container and mysqld exporters` | Cấu hình Prometheus, mysqld-exporter, cAdvisor, Node Exporter, Dashboard Grafana và hardening bảo mật. |
| **3** | `feat(logging): central logging with Loki and Promtail, LogQL queries and kiosk mode security` | Cấu hình Loki, Promtail scrape log, 3 truy vấn LogQL mẫu, phân quyền Kiosk, tài liệu hướng dẫn và báo cáo. |

---

## 📄 Tài liệu Đính kèm

- **Báo cáo tổng hợp môn học (≥ 10 trang)**: [`Bao_Cao_Tong_Hop_De27.md`](file:///d:/Du%20An/De27-DiemDanhSinhVien/Bao_Cao_Tong_Hop_De27.md)
- **Hướng dẫn chi tiết triển khai trên Ubuntu Server**: [`Huong_Dan_Trien_Khai_Ubuntu_Server.md`](file:///d:/Du%20An/De27-DiemDanhSinhVien/Huong_Dan_Trien_Khai_Ubuntu_Server.md)
- **Hướng dẫn chuyển code bằng FileZilla & Triển khai**: [`Huong_Dan_FileZilla_Trien_Khai_Ubuntu.md`](file:///d:/Du%20An/De27-DiemDanhSinhVien/Huong_Dan_FileZilla_Trien_Khai_Ubuntu.md)
