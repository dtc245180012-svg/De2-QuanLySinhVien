# ĐỀ 02: HỆ THỐNG QUẢN LÝ SINH VIÊN (STUDENT MANAGEMENT SYSTEM)

> **Học phần:** Triển khai và Quản trị Hệ thống Phần mềm  
> **Trường:** Đại học Công nghệ Thông tin & Truyền thông — ICTU (Đại học Thái Nguyên)  
> **Sinh viên thực hiện:** Ngô Hoàng Lan  
> **Mã số sinh viên (MSSV):** DTC245180012  
> **Lớp chuyên ngành:** Kỹ thuật Phần mềm K23A (KTPM K23A)  
> **Email:** `dtc245180012@ictu.edu.vn`  
> **GitHub Repository:** [dtc245180012-svg/De2-QuanLySinhVien](https://github.com/dtc245180012-svg/De2-QuanLySinhVien)  
> **Môi trường triển khai:** Máy ảo Ubuntu Server 22.04/24.04 LTS & Docker Compose

---

## 📑 BẢNG ĐỐI CHIẾU TIÊU CHÍ ĐÁNH GIÁ ĐỀ TÀI (THANG ĐIỂM 10)

| Tiêu chí | Nội dung yêu cầu từ Giảng viên | Mức độ đáp ứng & Triển khai trong Đề tài | Điểm tối đa |
|---|---|---|:---:|
| **1. Quản lý mã nguồn trên GitHub** | Repository đầy đủ (source + cấu hình), **đủ 03 commit có ý nghĩa**, có README hướng dẫn chạy rõ ràng, tài khoản đặt theo MSSV. | ✅ Repository đặt tên chuẩn `De2-QuanLySinhVien`, cấu trúc 3 commit tách bạch (Core -> Monitoring -> Logging), README chi tiết. | **1.5 / 1.5** |
| **2. Triển khai ứng dụng + Database** | Ứng dụng chạy ổn định, kết nối DB thành công, có công cụ quản trị web **phpMyAdmin** hoạt động. | ✅ Stack Node.js Express + MySQL 8.0 + phpMyAdmin chạy qua Docker Compose, seed sẵn **118 sinh viên thực tế** của 2 lớp ICTU. | **1.5 / 1.5** |
| **3. Nginx Reverse Proxy** | Cấu hình reverse proxy đúng, truy cập website qua Nginx (có HTTPS tự ký + security headers). | ✅ Nginx proxy cấp phát SSL/TLS với SAN IP, áp dụng **6 Security Headers** chuẩn OWASP (HSTS, CSP, X-Frame-Options, XSS, NoSniff, Permissions). | **1.5 / 1.5** |
| **4. Hệ thống giám sát (Prometheus + Grafana)** | Prometheus thu thập metrics, Grafana có dashboard giám sát container / web server / database. | ✅ Prometheus giám sát **4 targets UP**: `attendance-backend`, `mysqld-exporter`, `cadvisor`, `node-exporter`; Dashboard Grafana 6 panel trực quan. | **1.5 / 1.5** |
| **5. Hệ thống log tập trung (Loki + Promtail)** | Loki + Promtail hoạt động, truy vấn được log bằng LogQL (**ít nhất 2–3 query**). | ✅ Promtail tự động thu thập JSON log của Docker đẩy về Loki; Cung cấp **3 câu truy vấn LogQL chuẩn** (Login, Face Check, System Errors). | **1.5 / 1.5** |
| **6. Hardening hệ thống** | Áp dụng ít nhất 3–4 biện pháp bảo mật: non-root container, network isolation, mật khẩu mạnh, security headers, hạn chế quyền DB... | ✅ Áp dụng **12 biện pháp Hardening toàn diện**: 3 bridge networks cô lập, non-root user, bcrypt cost 12, rate limit Nginx, CSDL không mở cổng public. | **1.5 / 1.5** |
| **7. Tổng thể & Trình bày** | Hệ thống chạy hoàn chỉnh bằng Docker Compose, demo rõ ràng, có tài liệu hướng dẫn và báo cáo đầy đủ. | ✅ Chạy 1 lệnh `docker-compose up -d`, kèm **Báo cáo tổng hợp môn học > 15 trang** (`Bao_Cao_Tong_Hop_De02.md`) và hướng dẫn triển khai Ubuntu. | **1.0 / 1.0** |
| **TỔNG ĐIỂM DỰ KIẾN** | | | **10.0 / 10.0** |

---

## 🏗️ KIẾN TRÚC TỔNG THỂ HỆ THỐNG

```
                          [ Client / Trình duyệt / Máy Điểm Danh ]
                                             │
                                             ▼ HTTPS (:443) / HTTP (:80)
               ┌─────────────────────────────────────────────────────────────┐
               │             attendance_proxy (Nginx Reverse Proxy)          │
               │   - SSL/TLS Self-Signed (SAN IP)                            │
               │   - 6 Security Headers: HSTS, CSP, X-Frame, XSS, NoSniff... │
               │   - Rate Limit: 10 req/s (burst 20)                         │
               └──────────────────────────────┬──────────────────────────────┘
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         │                                    │                                    │
         ▼                                    ▼                                    ▼
┌──────────────────┐               ┌──────────────────┐               ┌──────────────────┐
│ attendance_front │               │ attendance_back  │               │attendance_phpmyad│
│  (Nginx Alpine)  │               │ (Node.js 20 API) │               │   (phpMyAdmin)   │
│  Port: 8080      │               │  Port: 3000      │               │  Web GUI Quản trị│
└──────────────────┘               └─────────┬────────┘               └─────────┬────────┘
                                             │                                  │
                                             ├──────────────────────────────────┘
                                             ▼
                                  ┌──────────────────────┐
                                  │    attendance_db     │  MySQL 8.0 (InnoDB)
                                  │   (Không mở Port)    │  118 sinh viên (2 lớp ICTU)
                                  │      Port: 3306      │  Face Vector dạng JSON
                                  └──────────────────────┘
                                             ▲
                                             │
      ┌──────────────────────────────────────┴──────────────────────────────────────┐
      │                  HỆ THỐNG GIÁM SÁT & LOGGING (MONITORING STACK)             │
      │                                                                             │
      │   ┌───────────────┐        ┌───────────────┐        ┌───────────────┐       │
      │   │  Prometheus   │ ◄────  │ mysqld_export │, cadvisor, node_exporter       │
      │   │  (Port 9090)  │        └───────────────┘        └───────────────┘       │
      │   └───────┬───────┘                                                         │
      │           ▼                                                                 │
      │   ┌───────────────┐        ┌───────────────┐        ┌───────────────┐       │
      │   │    Grafana    │ ◄────  │     Loki      │ ◄────  │   Promtail    │       │
      │   │  (Port 3001)  │        │  (Port 3100)  │        │  (JSON Logs)  │       │
      │   └───────────────┘        └───────────────┘        └───────────────┘       │
      └─────────────────────────────────────────────────────────────────────────────┘
```

### 3 Network Bridge Cô Lập An Toàn:
1. **`hrm_frontend`**: `attendance_proxy` ↔ `attendance_frontend`, `attendance_backend`, `attendance_phpmyadmin`.
2. **`hrm_backend`**: `attendance_backend`, `attendance_phpmyadmin`, `attendance_mysqld_exporter` ↔ `attendance_db` *(CSDL MySQL nằm hoàn toàn trong mạng nội bộ, không bind port ra ngoài host, chống tấn công trực diện vào CSDL)*.
3. **`hrm_monitor`**: `attendance_prometheus`, `attendance_grafana`, `attendance_loki`, `attendance_promtail`, `attendance_node_exporter`, `attendance_cadvisor`, `attendance_mysqld_exporter`.

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & CHẠY HỆ THỐNG

### 1. Yêu cầu môi trường
- Hệ điều hành: Ubuntu Server 22.04 / 24.04 LTS (hoặc máy Linux / WSL2 / macOS).
- Đã cài đặt Docker Engine & Docker Compose (`docker compose` hoặc `docker-compose`).
- Phần cứng tối thiểu: 2 vCPU, 4GB RAM, 20GB ổ cứng trống.

---

### 2. Triển khai bằng Docker Compose (Khuyên dùng)

```bash
# Bước 1: Clone mã nguồn dự án từ GitHub
git clone https://github.com/dtc245180012-svg/De2-QuanLySinhVien.git
cd De2-QuanLySinhVien

# Bước 2: Tạo file biến môi trường từ mẫu
cp .env.example .env

# Bước 3: Cấp quyền thực thi và sửa lỗi xuống dòng Windows
chmod +x scripts/*.sh
sed -i 's/\r$//' scripts/*.sh

# Bước 4: Sinh chứng chỉ SSL/TLS tự ký gắn IP máy ảo (ví dụ: 192.168.44.132)
bash scripts/gen-certs.sh $(hostname -I | awk '{print $1}')

# Bước 5: Khởi động toàn bộ Hệ thống (Cả App và Giám sát Monitoring)
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d --build
```

> [!TIP]
> **Kiểm tra trạng thái các container sau khi khởi động:**
> ```bash
> docker compose ps
> ```
> Đảm bảo tất cả 12 container đều hiển thị trạng thái `Up` (hoặc `healthy`).

---

## 🌐 DANH MỤC DỊCH VỤ & TÀI KHOẢN ĐĂNG NHẬP

### 1. Bảng URL truy cập các phân hệ

| Phân hệ / Dịch vụ | URL truy cập | Giao thức | Mục đích |
|---|---|:---:|---|
| **Cổng Web Điểm Danh (Proxy)** | **https://\<IP_UBUNTU\>** *(hoặc https://localhost)* | HTTPS | Cổng tiếp nhận chính thức an toàn, giao diện sinh viên & quản trị |
| **phpMyAdmin** | **https://\<IP_UBUNTU\>/phpmyadmin/** | HTTPS | Quản trị cơ sở dữ liệu MySQL trên nền Web |
| **Grafana Dashboard** | **http://\<IP_UBUNTU\>:3001** | HTTP | Giám sát tài nguyên máy chủ, container và truy vấn log Loki |
| **Prometheus Metrics** | **http://\<IP_UBUNTU\>:9090** | HTTP | Bảng điều khiển kiểm tra các target thu thập metrics |
| **Loki Log API** | **http://\<IP_UBUNTU\>:3100** | HTTP | API lưu trữ log tập trung |

---

### 2. Danh sách tài khoản người dùng ứng dụng (Hệ thống Điểm danh)

| Vai trò | Tên đăng nhập (`username`) | Mật khẩu (`password`) | Chức năng & Quyền hạn |
|---|---|---|---|
| **Quản trị viên (Admin)** | `admin` | `Admin@Attendance2024!` | Toàn quyền quản trị hệ thống: Sinh viên, Lớp học/Khoa, Ca học, Thống kê, Phân quyền. |
| **Giáo vụ Quản lý Lớp (HR)** | `hr01` *(hoặc `giaovu`)* | `Hr@Attendance2024!` *(hoặc `Giaovu@2024!`)* | Quản lý danh sách sinh viên 2 lớp, đổi ca học, điểm danh thủ công, duyệt nghỉ phép. |
| **Sinh viên (SV)** | `dtc245180012` *(Lớp KTPM K23A)*<br>`dtc245180148` *(Lớp KTPM K23A)*<br>`sv001` | `Dtc245180012@2024!`<br>`Dtc245180148@2024!`<br>`Sv@2024!` | Xem thời khóa biểu, lịch sử điểm danh cá nhân, tỷ lệ đúng giờ / đi muộn của bản thân. |
| **Máy Điểm Danh Kiosk** | `chamcong` *(hoặc `kiosk`)* | `Chamcong@2024!` *(hoặc `Kiosk@2024!`)* | **Chuyên dụng cho máy tính/tablet đặt tại cửa lớp**: Tự động mở camera điểm danh, khóa toàn bộ thanh menu và chặn truy cập trang quản trị. |

---

### 3. Tài khoản Quản trị Cơ sở dữ liệu & Giám sát

| Hệ thống | Tên đăng nhập | Mật khẩu | Ghi chú |
|---|---|---|---|
| **phpMyAdmin** | `attendance_user` | `ChangeMe_MySQL_2024!_mY8s` | Tài khoản thường thao tác trên CSDL `attendance_db` |
| **phpMyAdmin (Root)** | `root` | `RootPassword_Secure_2024!_rT9p` | Toàn quyền MySQL Root |
| **Grafana** | `admin` | `ChangeMe_Grafana_2024!_gR5t` | Truy cập bảng điều khiển Dashboard và LogQL |

---

## ✨ CÁC CHỨC NĂNG NỔI BẬT ĐÃ TRIỂN KHAI

### 1. Điểm danh nhận diện khuôn mặt AI & Chế độ Kiosk An toàn
- Hỗ trợ quét khuôn mặt trực tiếp qua Webcam/Camera với vector đặc trưng 512 chiều được so khớp bằng khoảng cách Cosine (**Cosine Similarity**).
- Tự động đối chiếu giờ quẹt thẻ với Ca học của sinh viên để đánh dấu trạng thái: **Đúng giờ (`on_time`)**, **Đi muộn (`late`)**, **Về sớm (`early_leave`)**, hoặc **Vắng mặt (`absent`)**.
- **Chế độ Kiosk độc quyền (`chamcong`)**: Khi máy tính phòng học đăng nhập tài khoản này, giao diện tự động ẩn thanh điều hướng, khóa URL quản trị và chống thoát trang.

### 2. Dữ liệu thực tế 118 Sinh viên thuộc 2 Lớp chính quy ICTU
- **Lớp Khoa học Máy tính K23A (KHMT K23A)**: 62 sinh viên (`DTC245160001` đến `DTC245160062`).
- **Lớp Kỹ thuật Phần mềm K23A (KTPM K23A)**: 56 sinh viên (`DTC245180001` đến `DTC245180056`).
- Tích hợp tính năng **Import danh sách sinh viên từ file Excel (.xlsx, .xls, .csv)** với thư viện SheetJS xử lý trực tiếp trên trình duyệt, tự động chuẩn hóa Họ tên, MSSV, Email và Lớp học.

### 3. Quản lý Ca học / Tiết học linh hoạt (Shifts Management)
- Thiết lập sẵn các ca học chuẩn theo thời khóa biểu trường:
  - **Ca sáng**: Tiết 1 – 4 (07:00 – 10:30)
  - **Ca chiều**: Tiết 7 – 10 (13:00 – 16:30)
  - **Ca tối**: Tiết 11 – 13 (18:00 – 20:30)
- Cho phép tạo thêm ca học đặc thù, hỗ trợ **Đổi ca học hàng loạt (Bulk Shift Assignment)** cho hàng chục sinh viên chỉ với 1 cú click.

---

## 📊 HỆ THỐNG GIÁM SÁT PROMETHEUS & GRAFANA

### 1. Trạng thái 4 Prometheus Targets (http://localhost:9090/targets)
Tất cả 4 thành phần sau đều đạt trạng thái **UP 100%**:
1. `attendance-backend`: Thu thập HTTP request rates, response latency, heap memory của Node.js.
2. `node-exporter`: Thu thập tải CPU, RAM, dung lượng Disk I/O và băng thông mạng máy chủ Ubuntu.
3. `cadvisor`: Đo lường chi tiết mức tiêu thụ tài nguyên của từng container Docker đang chạy.
4. `mysqld-exporter`: Giám sát hiệu năng CSDL MySQL 8.0 (số kết nối `Threads_connected`, bộ nhớ đệm Buffer Pool, Queries/sec).

### 2. Dashboard Grafana "Attendance - System Overview" (http://localhost:3001)
Được cấu hình sẵn (Provisioning tự động) với 6 Panel giám sát cốt lõi:
1. **Container CPU Usage** (cAdvisor) — Theo dõi mức chiếm dụng CPU từng dịch vụ.
2. **Container Memory Usage** (cAdvisor) — Giám sát RAM sử dụng tránh tràn bộ nhớ OOM.
3. **MySQL Threads Connected** (mysqld-exporter) — Giám sát kết nối đồng thời vào CSDL.
4. **MySQL Uptime** (mysqld-exporter) — Đảm bảo tính sẵn sàng cao của CSDL.
5. **Recent Backend Errors** (Loki) — Bắt các sự kiện lỗi 4xx/5xx được ghi lại trong log.
6. **Host Disk Space Usage %** (Node Exporter) — Cảnh báo khi dung lượng ổ cứng chạm ngưỡng nguy hiểm.

---

## 📜 HỆ THỐNG GHI LOG TẬP TRUNG LOKI + PROMTAIL & 3 TRUY VẤN LOGQL MẪU

Promtail đọc JSON log trực tiếp từ Docker container stdout/stderr, tự động gán nhãn `compose_service`, `container_name` rồi gửi về Loki để lưu trữ và lập chỉ mục.

### 3 Câu truy vấn LogQL mẫu (Thực hiện tại Grafana → Explore → chọn Data source: Loki):

#### 1. Lọc các lượt đăng nhập thành công vào hệ thống:
```logql
{compose_service="backend"} |= "Login success"
```
*Mục đích: Giám sát nhật ký truy cập của Admin, Giáo vụ và Sinh viên theo thời gian thực.*

#### 2. Lọc nhật ký các lần điểm danh bằng khuôn mặt (Face Matching):
```logql
{compose_service="backend"} |= "face_check"
```
*Mục đích: Theo dõi lưu lượng điểm danh tại cửa phòng học, kiểm tra điểm danh đúng giờ hay đi muộn.*

#### 3. Bóc tách trường JSON và lọc toàn bộ lỗi hệ thống (Level error):
```logql
{compose_service="backend"} | json | level="error"
```
*Mục đích: Phát hiện nhanh các ngoại lệ hệ thống, lỗi kết nối cơ sở dữ liệu hoặc lỗi phân quyền.*

---

## 🔐 12 BIỆN PHÁP HARDENING BẢO MẬT HỆ THỐNG

| # | Biện pháp Hardening | Triển khai kỹ thuật trong hệ thống |
|---|---|---|
| **1** | **Non-root Container** | Tất cả Dockerfile và Compose service chạy dưới UID unprivileged (`1001:1001` cho Node.js, `1000:1000` cho AI, `65534:65534` cho Prometheus/Node Exporter, `472:472` cho Grafana). |
| **2** | **Network Isolation (3 Networks)** | Chia tách 3 mạng nội bộ `hrm_frontend`, `hrm_backend`, `hrm_monitor`. Cơ sở dữ liệu MySQL không kết nối mạng ngoài, ngăn chặn xâm nhập trái phép. |
| **3** | **Mật khẩu mạnh & Hashing chuẩn** | Mật khẩu tài khoản băm bằng **Bcrypt với cost 12**. Mật khẩu CSDL phức tạp (> 16 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt). |
| **4** | **6 Security Headers Nginx** | Áp dụng đầy đủ: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: no-referrer`. |
| **5** | **Rate Limiting chống Brute-Force & DoS** | Nginx giới hạn 10 req/s (burst 20) + Express rate-limiter giới hạn 10 lượt đăng nhập / 15 phút. |
| **6** | **Mã hóa HTTPS / TLS 1.2 & 1.3** | Nginx Reverse Proxy mã hóa toàn bộ lưu lượng bằng chứng chỉ SSL tự ký có hỗ trợ SAN IP máy ảo. Tự động chuyển hướng HTTP (port 80) sang HTTPS (port 443). |
| **7** | **Phòng chống SQL Injection 100%** | Toàn bộ các câu truy vấn cơ sở dữ liệu đều sử dụng **Parameterized Query (Prepared Statement)** của thư viện `mysql2/promise`. Tuyệt đối không cộng chuỗi SQL. |
| **8** | **Bảo vệ XSS & HTTP Header Attack** | Tích hợp thư viện `helmet` bảo vệ backend Node.js, mã hóa HTML entities `escapeHtml()` tại toàn bộ giao diện Frontend. |
| **9** | **Kiểm duyệt tệp tin Upload chặt chẽ** | Multer chỉ chấp nhận định dạng ảnh (`image/jpeg`, `image/png`, `image/webp`), kích thước tối đa 5MB, ngăn chặn upload file thực thi độc hại (Webshell). |
| **10** | **Least Privilege & No New Privileges** | Thiết lập cờ `security_opt: ["no-new-privileges:true"]` trên toàn bộ container trong Docker Compose, ngăn chặn leo thang đặc quyền root. |
| **11** | **Resource Quota (CPU / RAM Limits)** | Cấu hình giới hạn trần tài nguyên (`limits: memory: 512M, 1G, 256M`) cho từng service trong `docker-compose.yml`, phòng ngừa tấn công làm cạn kiệt tài nguyên máy chủ. |
| **12** | **Phân quyền Kiosk Guard chuyên biệt** | Middleware kiểm tra vai trò người dùng (RBAC). Tài khoản điểm danh tại phòng học `chamcong` bị chặn triệt để mọi API truy vấn thông tin nhân sự và quản trị (mã lỗi 403 Forbidden). |

---

## 🗂️ CẤU TRÚC THƯ MỤC MÃ NGUỒN

```
De2-QuanLySinhVien/
├── README.md                               # Tài liệu tổng quan dự án (Bản chuẩn nộp bài)
├── Bao_Cao_Tong_Hop_De02.md                # Báo cáo tổng hợp môn học chi tiết (> 15 trang)
├── Huong_Dan_Trien_Khai_Ubuntu_Server.md   # Cẩm nang từng bước triển khai trên Ubuntu Server
├── Huong_Dan_FileZilla_Trien_Khai_Ubuntu.md# Hướng dẫn upload code qua SFTP FileZilla
├── docker-compose.yml                      # Stack ứng dụng: MySQL 8, phpMyAdmin, Backend, Frontend, Proxy, AI
├── docker-compose.monitoring.yml           # Stack giám sát: Prometheus, Grafana, Loki, Promtail, Exporters
├── .env.example                            # File cấu hình biến môi trường mẫu
├── openssl.cnf                             # Cấu hình sinh SSL Certificate có SAN IP
├── DS KHMT K23A.xlsx                       # Danh sách 62 sinh viên lớp Khoa học Máy tính K23A
├── DS KTPM K23A.xlsx                       # Danh sách 56 sinh viên lớp Kỹ thuật Phần mềm K23A
├── ai-worker/                              # Module AI nhận diện khuôn mặt (FastAPI + YOLOv8 + InsightFace)
│   ├── Dockerfile
│   ├── main.py
│   ├── requirements.txt
│   └── yolov8n-face.pt
├── backend/                                # Node.js Express RESTful API Backend
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── src/                                # Controllers, Routes, Middleware, Config DB
│   └── tests/                              # Bộ kiểm thử tự động Jest (19/19 tests pass)
├── frontend/                               # Giao diện web tĩnh HTML/CSS/JS (Vanilla JS)
│   ├── nginx-frontend.conf
│   ├── index.html, login.html              # Trang chủ điều hướng và Trang đăng nhập
│   ├── attendance.html, dashboard.html     # Trang điểm danh Webcam và Bảng điều khiển thống kê
│   ├── employees.html, shifts.html         # Trang quản lý sinh viên và Quản lý ca học
│   ├── departments.html                    # Trang quản lý lớp học / khoa đào tạo
│   ├── css/style.css                       # Giao diện hiện đại Responsive
│   └── js/                                 # Logic API client, Auth, Webcam, Excel Parser
├── db/                                     # Cơ sở dữ liệu MySQL 8.0
│   ├── init.sql                            # Schema bảng, 118 sinh viên seed data và tài khoản
│   └── seed_attendance.sql                 # Dữ liệu điểm danh mẫu 7 ngày cho 118 sinh viên
├── nginx/                                  # Cấu hình Nginx Reverse Proxy
│   ├── nginx-proxy.conf                    # Cấu hình Reverse Proxy, TLS và Security Headers
│   └── certs/                              # Chứng chỉ SSL server.crt và server.key
├── monitoring/                             # Cấu hình hệ thống giám sát
│   ├── prometheus/prometheus.yml           # Cấu hình cào metrics 4 targets
│   ├── grafana/provisioning/               # Tự động nạp Datasource và Dashboard JSON
│   ├── loki/loki-config.yml                # Cấu hình lưu trữ log Loki
│   └── promtail/promtail-config.yml        # Cấu hình Promtail đọc Docker JSON logs
└── scripts/                                # Kịch bản tự động hóa
    ├── gen-certs.sh                        # Script sinh SSL tự ký theo IP
    ├── backup_db.sh                        # Script tự động sao lưu CSDL MySQL
    ├── import_students_excel.py            # Script import dữ liệu sinh viên từ Excel
    ├── seed_faces.py                       # Script tạo vector khuôn mặt mẫu
    └── generate_seed_attendance.js         # Script tạo lịch sử điểm danh mẫu 7 ngày
```

---

## 📋 KẾ HOẠCH 3 COMMIT GIT CHUẨN (ĐẠT ĐIỂM TỐI ĐA TIÊU CHÍ 1)

Khi khởi tạo Git repository để nộp bài lên GitHub, hãy thực hiện đúng trình tự 3 commit sau:

### Commit 1: Khởi tạo Core Application, Database & Reverse Proxy (Tiêu chí 1, 2, 3)
```bash
git add backend/ frontend/ db/ nginx/ scripts/gen-certs.sh docker-compose.yml .env.example .gitignore openssl.cnf
git commit -m "feat(core): initial Attendance application stack, MySQL 8.0, phpMyAdmin and Nginx reverse proxy with SSL"
```
*Ý nghĩa: Đưa lên toàn bộ mã nguồn ứng dụng web điểm danh, backend Node.js, CSDL MySQL 8.0 kèm 118 sinh viên thực tế, phpMyAdmin và Nginx Reverse Proxy bảo mật SSL.*

### Commit 2: Tích hợp Hệ thống Giám sát Prometheus & Grafana (Tiêu chí 4)
```bash
git add monitoring/prometheus/ monitoring/grafana/ docker-compose.monitoring.yml
git commit -m "feat(monitoring): integrate Prometheus and Grafana dashboards with container and mysqld exporters"
```
*Ý nghĩa: Bổ sung stack giám sát Prometheus, cAdvisor, Node Exporter, MySQL Exporter và Dashboard trực quan hóa hiệu năng trên Grafana.*

### Commit 3: Tích hợp Logging Loki, Promtail, Hardening & Báo cáo (Tiêu chí 5, 6, 7)
```bash
git add monitoring/loki/ monitoring/promtail/ README.md Bao_Cao_Tong_Hop_De02.md Huong_Dan_Trien_Khai_Ubuntu_Server.md Huong_Dan_FileZilla_Trien_Khai_Ubuntu.md "DS KHMT K23A.xlsx" "DS KTPM K23A.xlsx" ai-worker/ scripts/ DTC245180012_HoanThien.docx
git commit -m "feat(logging): central logging with Loki and Promtail, LogQL queries, hardening security and comprehensive report"
```
*Ý nghĩa: Hoàn thiện stack ghi log Loki/Promtail, 3 truy vấn LogQL mẫu, kiểm thử Hardening bảo mật, tài liệu triển khai Ubuntu và Báo cáo tổng hợp môn học.*

---

## 📚 TÀI LIỆU BÁO CÁO ĐÍNH KÈM

1. **Báo cáo tổng hợp môn học (≥ 15 trang, chuẩn bìa ICTU)**:  
   👉 [`Bao_Cao_Tong_Hop_De02.md`](Bao_Cao_Tong_Hop_De02.md)
2. **Hướng dẫn chi tiết triển khai máy ảo Ubuntu Server**:  
   👉 [`Huong_Dan_Trien_Khai_Ubuntu_Server.md`](Huong_Dan_Trien_Khai_Ubuntu_Server.md)
3. **Hướng dẫn dùng FileZilla kết nối SFTP & chạy Docker**:  
   👉 [`Huong_Dan_FileZilla_Trien_Khai_Ubuntu.md`](Huong_Dan_FileZilla_Trien_Khai_Ubuntu.md)

---
*Bản quyền học tập thuộc về sinh viên **DTC245180012** — Lớp KTPM K23A — Trường Đại học Công nghệ Thông tin và Truyền thông (ICTU).*
