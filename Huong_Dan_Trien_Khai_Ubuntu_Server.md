# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG ĐIỂM DANH SINH VIÊN (ATTENDANCE) TRÊN MÁY ẢO UBUNTU SERVER

> **Môn học:** Triển khai và Quản trị Hệ thống Phần mềm  
> **Đề tài:** Đề 27 — Hệ thống Điểm danh Sinh viên (Trường ĐH CNTT & Truyền thông - ICTU)  
> **Sinh viên thực hiện:** DTC245160039  
> **Email:** dtc245160039@ictu.edu.vn  
> **GitHub:** [dtc245160039-max/dtc245160039-De27-HeThongDiemDanh](https://github.com/dtc245160039-max/dtc245160039-De27-HeThongDiemDanh)  
> **Môi trường triển khai:** Máy ảo Ubuntu Server (22.04 LTS hoặc 24.04 LTS)  
> **Công nghệ cốt lõi:** Docker, Docker Compose, Nginx, Node.js, MySQL 8.0, phpMyAdmin, Prometheus, Grafana, Loki + Promtail  

---

## 📑 MỤC LỤC

1. [Tổng quan kiến trúc & Yêu cầu phần cứng](#1-tổng-quan-kiến-trúc--yêu-cầu-phần-cứng)
2. [Sơ đồ mạng & Bảng ánh xạ cổng (Port Mapping)](#2-sơ-đồ-mạng--bảng-ánh-xạ-cổng-port-mapping)
3. [Bước 1: Chuẩn bị máy ảo Ubuntu Server](#bước-1-chuẩn-bị-máy-ảo-ubuntu-server)
4. [Bước 2: Cài đặt Docker Engine & Docker Compose Plugin](#bước-2-cài-đặt-docker-engine--docker-compose-plugin)
5. [Bước 3: Đưa mã nguồn Hệ thống Điểm danh lên máy ảo Ubuntu Server](#bước-3-đưa-mã-nguồn-hệ-thống-điểm-danh-lên-máy-ảo-ubuntu-server)
6. [Bước 4: Cấu hình biến môi trường & Chứng chỉ SSL/TLS](#bước-4-cấu-hình-biến-môi-trường--chứng-chỉ-ssltls)
7. [Bước 5: Khởi động toàn bộ hệ thống bằng Docker Compose](#bước-5-khởi-động-toàn-bộ-hệ-thống-bằng-docker-compose)
8. [Bước 6: Thiết lập chế độ Kiosk cho máy điểm danh tại cửa phòng học](#bước-6-thiết-lập-chế-độ-kiosk-cho-máy-điểm-danh-tại-cửa-phòng-học)
9. [Bước 7: Kiểm thử & Khai thác các dịch vụ giám sát (Prometheus, Grafana, LogQL)](#bước-7-kiểm-thử--khai-thác-các-dịch-vụ-giám-sát-prometheus-grafana-logql)
10. [Bước 8: Kế hoạch 3 Commit Git chuẩn để nộp bài đạt điểm tối đa](#bước-8-kế-hoạch-3-commit-git-chuẩn-để-nộp-bài-đạt-điểm-tối-đa)
11. [Xử lý sự cố thường gặp (Troubleshooting) & Vận hành định kỳ](#11-xử-lý-sự-cố-thường-gặp-troubleshooting--vận-hành-định-kỳ)

---

## 1. Tổng quan kiến trúc & Yêu cầu phần cứng

### 1.1. Cấu hình máy ảo khuyến nghị (VMware / VirtualBox / Hyper-V / Proxmox)
- **Hệ điều hành:** Ubuntu Server 22.04 LTS hoặc 24.04 LTS (x86_64).
- **CPU:** Tối thiểu 2 vCPU (khuyến nghị 2 – 4 vCPU).
- **RAM:** Tối thiểu 4 GB (khuyến nghị 4 GB – 6 GB để chạy đồng thời MySQL 8.0, Backend Node.js và stack Prometheus/Grafana/Loki).
- **Ổ cứng (Disk):** Tối thiểu 20 GB SSD trống.
- **Card mạng (Network Adapter):** Cấu hình chế độ **Bridged Adapter** (để máy ảo nhận cùng dải IP với máy tính thật và mạng LAN, giúp máy điểm danh và các máy trạm dễ dàng truy cập).

### 1.2. Danh sách các container trong hệ thống

| Container | Image / Công nghệ | Vai trò trong hệ thống |
|---|---|---|
| `attendance_proxy` | Nginx Alpine (Reverse Proxy) | Điểm tiếp nhận duy nhất từ bên ngoài, mã hóa HTTPS, cấp phát SSL, security headers |
| `attendance_frontend` | Nginx Alpine | Phục vụ mã nguồn giao diện web tĩnh (HTML/CSS/JS) |
| `attendance_backend` | Node.js 20 Alpine | RESTful API, xác thực JWT, phân quyền RBAC, nghiệp vụ điểm danh sinh viên & ca học, tính toán Cosine AI |
| `attendance_db` | `mysql:8.0` | CSDL MySQL 8.0 lưu trữ sinh viên, ca học, lịch sử điểm danh, vector khuôn mặt dạng JSON |
| `attendance_phpmyadmin` | `phpmyadmin/phpmyadmin:latest` | Giao diện web quản trị cơ sở dữ liệu MySQL |
| `attendance_prometheus`| Prometheus v2.55 | Hệ thống thu thập và lưu trữ time-series metrics |
| `attendance_grafana` | Grafana 11.2 | Bảng điều khiển trực quan hóa metrics và truy vấn log tập trung |
| `attendance_loki` | Grafana Loki v3.2 | Hệ thống lưu trữ và quản lý log tập trung |
| `attendance_promtail` | Grafana Promtail v3.2 | Thu thập JSON logs từ Docker daemon gửi về Loki |
| `attendance_node_exporter` | Node Exporter v1.8 | Thu thập thông số phần cứng máy chủ (CPU, RAM, Disk, Network) |
| `attendance_mysqld_exporter`| MySQL Exporter v0.15 | Thu thập metrics hoạt động của MySQL 8.0 |
| `attendance_cadvisor` | Google cAdvisor v0.49 | Thu thập tài nguyên chi tiết của từng container Docker |

---

## 2. Sơ đồ mạng & Bảng ánh xạ cổng (Port Mapping)

```
                            [ Trình duyệt Client / Máy Điểm Danh Kiosk ]
                                                 │
                                                 │ HTTPS (Port 443) / HTTP (Port 80)
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ MÁY CHỦ UBUNTU SERVER (Host IP: 192.168.x.x)                                           │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ attendance_proxy (Nginx Reverse Proxy :80, :443)                               │   │
│   │ - Tự động Redirect HTTP -> HTTPS                                               │   │
│   │ - Áp dụng 6 Security Headers (HSTS, CSP, X-Frame-Options, XSS, NoSniff...)     │   │
│   └──────┬───────────────────────────────┬───────────────────────────────┬─────────┘   │
│          │ /                             │ /api/                         │ /phpmyadmin/│
│          ▼                               ▼                               ▼             │
│   ┌──────────────────┐           ┌──────────────────┐            ┌──────────────────┐  │
│   │attendance_front  │           │attendance_back   │            │attendance_phpmyad│  │
│   │ (Port 8080)      │           │ (Port 3000)      │            │ (Port 80)        │  │
│   └──────────────────┘           └──────┬───────────┘            └──────────────────┘  │
│                                         │                                              │
│                        ┌────────────────┴────────────────┐                             │
│                        ▼                                 ▼                             │
│               ┌──────────────────┐              ┌──────────────────┐                   │
│               │attendance_db     │              │attendance_ai     │                   │
│               │ (MySQL 8.0: 3306)│              │ (FastAPI: 8000)  │                   │
│               └──────────────────┘              └──────────────────┘                   │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ STACK GIÁM SÁT & LOG TẬP TRUNG                                                 │   │
│   │ - Prometheus (Port 9090) ◄── [node-exporter, cadvisor, mysqld-exporter]        │   │
│   │ - Grafana (Port 3001)    ◄── Truy vấn số liệu từ Prometheus & LogQL từ Loki    │   │
│   │ - Loki (Port 3100)       ◄── Promtail scrape logs container Docker             │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Bảng mở cổng trên Firewall máy chủ:

| Cổng (Port) | Giao thức | Dịch vụ | Mục đích sử dụng |
|---|---|---|---|
| **22** | TCP | OpenSSH | Quản trị từ xa máy ảo Ubuntu |
| **80** | TCP | HTTP Proxy | Tự động chuyển hướng (Redirect 301) sang HTTPS |
| **443** | TCP | HTTPS Proxy | **Cổng chính truy cập Điểm danh, Quản trị, phpMyAdmin (/phpmyadmin/)** |
| **8080** | TCP | Frontend trực tiếp | Truy cập giao diện trực tiếp (tuỳ chọn) |
| **3001** | TCP | Grafana | Truy cập bảng điều khiển giám sát & tra cứu LogQL |
| **9090** | TCP | Prometheus | Kiểm tra tình trạng các target giám sát |

*(Lưu ý bảo mật: Cổng CSDL MySQL `3306` được cô lập hoàn toàn trong mạng nội bộ Docker `attendance_backend_net`, không mở trực tiếp ra ngoài internet/LAN).*

---

## Bước 1: Chuẩn bị máy ảo Ubuntu Server

Đăng nhập vào máy ảo Ubuntu Server qua SSH hoặc Terminal console.

### 1.1. Cập nhật hệ điều hành
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2. Cài đặt các gói công cụ thiết yếu
```bash
sudo apt install -y curl wget git openssl ca-certificates gnupg lsb-release ufw htop net-tools
```

### 1.3. Xác định địa chỉ IP máy ảo
Chạy lệnh sau để lấy địa chỉ IP LAN của máy ảo:
```bash
ip a
```
*Ghi nhớ địa chỉ IP này (ví dụ: `192.168.1.50`).*

### 1.4. Thiết lập tường lửa UFW (Uncomplicated Firewall)
Bảo vệ máy chủ bằng cách chỉ cho phép các cổng cần thiết:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow 8080/tcp comment 'Attendance Frontend'
sudo ufw allow 3001/tcp comment 'Grafana'
sudo ufw allow 9090/tcp comment 'Prometheus'
sudo ufw --force enable
sudo ufw status verbose
```

---

## Bước 2: Cài đặt Docker Engine & Docker Compose Plugin

Cài đặt phiên bản Docker CE chính thức từ Docker Repository (không dùng bản apt cũ):

### 2.1. Thêm Docker GPG Key và Repository
```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
```

### 2.2. Cài đặt Docker và Docker Compose Plugin
```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 2.3. Cấu hình phân quyền người dùng (chạy Docker không cần `sudo`)
```bash
sudo usermod -aG docker $USER
sudo systemctl enable docker
sudo systemctl start docker
```
*Thực hiện lệnh sau để cập nhật group ngay lập tức mà không cần đăng xuất:*
```bash
newgrp docker
```

### 2.4. Kiểm tra phiên bản cài đặt thành công
```bash
docker --version
docker compose version
```
*(Yêu cầu Docker Engine >= 24.0 và Docker Compose >= v2.20).*

---

## Bước 3: Đưa mã nguồn Hệ thống Điểm danh lên máy ảo Ubuntu Server

### Cách 1: Clone trực tiếp từ GitHub cá nhân (Khuyến nghị chuẩn đề bài)
```bash
cd ~
git clone https://github.com/dtc245160039-max/dtc245160039-De27-HeThongDiemDanh.git
cd dtc245160039-De27-HeThongDiemDanh
```

### Cách 2: Copy thư mục dự án từ máy tính thật Windows sang Ubuntu (qua SCP)
Mở PowerShell trên máy Windows, điều hướng đến thư mục chứa dự án và chạy:
```powershell
scp -r "d:\Du An\De27-DiemDanhSinhVien" <ten_user_ubuntu>@<IP_UBUNTU>:~/dtc245160039-De27-HeThongDiemDanh
```

### Cách 3: Chuyển toàn bộ code bằng phần mềm FileZilla (Trực quan, kéo thả dễ nhất)
> 📖 **Xem hướng dẫn chi tiết từng bước có hình minh họa tại file:** [`Huong_Dan_FileZilla_Trien_Khai_Ubuntu.md`](file:///d:/Du%20An/De27-DiemDanhSinhVien/Huong_Dan_FileZilla_Trien_Khai_Ubuntu.md)
1. Cài đặt OpenSSH trên Ubuntu: `sudo apt install -y openssh-server && sudo systemctl enable --now ssh`
2. Mở FileZilla trên Windows, nhập Quickconnect:
   - **Host:** `sftp://<IP_UBUNTU>`
   - **Username / Password:** Tài khoản đăng nhập máy ảo Ubuntu
   - **Port:** `22`
3. Kéo toàn bộ thư mục dự án bên trái thả sang `/home/<user>/dtc245160039-De27-HeThongDiemDanh` bên phải.

Sau đó trên Ubuntu:
```bash
cd ~/dtc245160039-De27-HeThongDiemDanh
```

### 3.1. Phân quyền thực thi cho các file script
```bash
chmod +x scripts/*.sh
```

---

## Bước 4: Cấu hình biến môi trường & Chứng chỉ SSL/TLS

### 4.1. Tạo file cấu hình môi trường `.env`
Sao chép từ file mẫu:
```bash
cp .env.example .env
```

Nếu muốn điều chỉnh cấu hình (mật khẩu CSDL, ngưỡng nhận diện khuôn mặt...), mở file `.env`:
```bash
nano .env
```
Các thông số chính cần lưu ý:
- `MYSQL_DATABASE=attendance_db`
- `MYSQL_USER=attendance_user`
- `MYSQL_PASSWORD=ChangeMe_MySQL_2024!_mY8s`
- `MYSQL_ROOT_PASSWORD=RootPassword_Secure_2024!_rT9p`
- `JWT_SECRET=ThayTheBangKhoaBaoMatDaiToiThieu32KyTuRandom!`
- `FACE_MATCH_THRESHOLD=0.45` (Ngưỡng khoảng cách cosine: càng nhỏ càng nghiêm ngặt).

### 4.2. Tạo chứng chỉ SSL/TLS tự ký hỗ trợ IP máy ảo Ubuntu (SAN IP)
Trình duyệt yêu cầu kết nối **HTTPS an toàn** thì mới cho phép cấp quyền truy cập Camera/Webcam để điểm danh.

Để tránh lỗi chứng chỉ không hợp lệ khi truy cập qua IP mạng LAN của máy ảo, hãy thêm IP máy ảo vào file `openssl.cnf`:
```bash
nano openssl.cnf
```
Thêm dòng địa chỉ IP máy ảo Ubuntu của bạn vào mục `[alt_names]`:
```ini
[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = 192.168.1.50   <--- (Thay bằng địa chỉ IP thật của máy ảo Ubuntu)
```
Lưu lại (`Ctrl + O`, `Enter`, `Ctrl + X`), sau đó chạy script sinh chứng chỉ:
```bash
bash scripts/gen-certs.sh
```
Kết quả sinh ra 2 file chứng chỉ bảo mật tại `nginx/certs/cert.pem` và `nginx/certs/key.pem`.

---

## Bước 5: Khởi động toàn bộ hệ thống bằng Docker Compose

### 5.1. Khởi động Stack ứng dụng chính (Attendance Application Stack)
Lệnh này sẽ tự động khởi tạo CSDL MySQL 8.0, nạp schema `db/init.sql`, khởi tạo phpMyAdmin, build image Node.js Backend và Nginx Reverse Proxy:
```bash
docker compose up -d --build
```
*Lần đầu tiên build có thể mất 1 - 2 phút tùy tốc độ mạng.*

### 5.2. Khởi động Stack Giám sát & Ghi log tập trung (Monitoring Stack)
Khởi động Prometheus, Grafana, Loki, Promtail và 3 Exporter giám sát (bao gồm `mysqld-exporter`):
```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

### 5.3. Kiểm tra trạng thái hoạt động của toàn bộ containers
```bash
docker compose ps
```
Tất cả các container phải ở trạng thái **Up / Up (healthy)**:
```
NAME                           STATUS                  PORTS
attendance_proxy               Up                      0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
attendance_frontend            Up                      0.0.0.0:8080->80/tcp
attendance_backend             Up (healthy)            3000/tcp
attendance_db                  Up (healthy)            3306/tcp
attendance_phpmyadmin          Up                      0.0.0.0:8081->80/tcp
attendance_prometheus          Up                      0.0.0.0:9090->9090/tcp
attendance_grafana             Up                      0.0.0.0:3001->3000/tcp
attendance_loki                Up                      0.0.0.0:3100->3100/tcp
attendance_promtail            Up                      
attendance_node_exporter       Up                      9100/tcp
attendance_mysqld_exporter     Up                      9104/tcp
attendance_cadvisor            Up (healthy)            8080/tcp
```

### 5.4. Xem log thời gian thực để kiểm tra kết nối
```bash
# Xem log backend Node.js
docker compose logs -f --tail=50 backend

# Xem log CSDL MySQL
docker compose logs -f --tail=50 db
```
Khi thấy dòng thông báo `Attendance backend listening on port 3000` và `Connected to MySQL database: attendance_db` là hệ thống đã hoạt động hoàn hảo.

---

## Bước 6: Thiết lập chế độ Kiosk cho máy điểm danh tại cửa phòng học

Hệ thống đã được thiết kế sẵn tài khoản và vai trò chuyên dụng cho máy tính/máy tính bảng gắn ở cửa phòng học hoặc giảng đường.

### 6.1. Thông tin đăng nhập máy điểm danh
- **Địa chỉ:** `https://<IP_UBUNTU>/login.html` (hoặc `https://<IP_UBUNTU>/attendance.html`)
- **Tên đăng nhập:** `chamcong` *(hoặc `kiosk`)*
- **Mật khẩu:** `Chamcong@2024!` *(hoặc `Kiosk@2024!`)*

### 6.2. Cơ chế khóa an toàn (Kiosk Security Guard)
- Khi đăng nhập bằng tài khoản này, giao diện sẽ **ẩn toàn bộ** menu Dashboard, Quản lý sinh viên, Lớp học, Ca học.
- Tiêu đề chuyển sang **"Máy điểm danh sinh viên (Kiosk Cửa phòng học)"**.
- Người dùng đứng trước máy điểm danh **hoàn toàn không thể mở các trang quản trị khác** (nếu cố tình nhập URL khác vào trình duyệt, hệ thống sẽ tự động bắt giữ và điều hướng ngược lại trang điểm danh; đồng thời API backend sẽ trả về mã `403 Forbidden`).

### 6.3. Cấu hình trình duyệt mở chế độ Kiosk Fullscreen tự động
Nếu máy điểm danh chạy Ubuntu Desktop / Raspberry Pi / Windows, bạn có thể tạo shortcut khởi động toàn màn hình (Kiosk mode) không hiện thanh công cụ và bỏ qua cảnh báo SSL tự ký:

**Trên Linux / Ubuntu:**
```bash
chromium-browser --kiosk --incognito --ignore-certificate-errors --use-fake-ui-for-media-stream "https://192.168.1.50/attendance.html"
```

**Trên Windows (Tạo Shortcut Google Chrome):**
```cmd
chrome.exe --kiosk --incognito --ignore-certificate-errors --use-fake-ui-for-media-stream "https://192.168.1.50/attendance.html"
```
*(Tham số `--use-fake-ui-for-media-stream` tự động cấp quyền mở Webcam mà không hiển thị pop-up hỏi người dùng).*

---

## Bước 7: Kiểm thử & Khai thác các dịch vụ giám sát (Prometheus, Grafana, LogQL)

Từ trình duyệt của máy tính trạm cùng mạng LAN, mở các địa chỉ sau:

### 7.1. Ứng dụng Điểm danh Sinh viên (Attendance System) - Đề 27
- **URL:** `https://<IP_UBUNTU>`
- Đăng nhập bằng tài khoản Quản trị viên: `admin` / `Admin@Attendance2024!`
- Kiểm tra các chức năng:
  - **Dashboard:** Xem thống kê biểu đồ điểm danh thời gian thực, nhấp vào thẻ Đúng giờ / Đi muộn / Về sớm / Vắng mặt để lọc danh sách.
  - **Sinh viên:** Thêm sinh viên mới, chụp ảnh đăng ký khuôn mặt, chỉnh sửa, phân lớp học, nhập danh sách từ Excel (.xlsx, .csv).
  - **Nghỉ phép:** Đăng ký ngày bắt đầu và ngày kết thúc nghỉ phép (hệ thống tự động cập nhật trạng thái khi hết hạn nghỉ).
  - **Ca học:** Tạo ca học mới, phân ca hàng loạt cho sinh viên cả lớp.

### 7.2. Quản trị cơ sở dữ liệu phpMyAdmin
- **URL:** `https://<IP_UBUNTU>/phpmyadmin/` (hoặc cổng trực tiếp `http://<IP_UBUNTU>:8081`)
- **Tài khoản đăng nhập phpMyAdmin:**
  - **Server:** `db`
  - **Username:** `attendance_user` (hoặc `root`)
  - **Password:** `ChangeMe_MySQL_2024!_mY8s` (hoặc mật khẩu root: `RootPassword_Secure_2024!_rT9p`)
- **Kiểm tra CSDL trong phpMyAdmin:**
  - Chọn database `attendance_db`.
  - Xem danh sách bảng: `departments`, `shifts`, `employees` (chứa cột `face_embedding` lưu vector khuôn mặt dạng JSON), `attendance`, `users`, `audit_log`.
  - Xem trực tiếp dữ liệu mẫu sinh viên và nhật ký điểm danh.

### 7.3. Giám sát hệ thống với Prometheus
- **URL:** `http://<IP_UBUNTU>:9090`
- Vào menu **Status** -> **Targets**.
- Xác nhận 4 endpoint giám sát đều ở trạng thái **UP** (xanh lá cây):
  - `attendance-backend` (Node.js metrics: request count, latency)
  - `node-exporter` (CPU, RAM, Disk máy chủ)
  - `cadvisor` (Tài nguyên từng container Docker)
  - `mysqld-exporter` (Hiệu năng CSDL MySQL 8.0)

### 7.4. Trực quan hóa & Truy vấn Log với Grafana + Loki (LogQL)
- **URL:** `http://<IP_UBUNTU>:3001`
- **Tài khoản:** `admin` / `ChangeMe_Grafana_2024!_gR5t`
- **Xem Dashboard sẵn có:**
  - Vào **Dashboards** -> mở dashboard **"Attendance - System Overview"**.
  - Theo dõi 6 panel: Container CPU Usage, Container Memory Usage, MySQL Threads Connected, MySQL Uptime, Recent backend errors (Loki), Host Disk Usage.

- **Thực hiện 3 câu truy vấn LogQL mẫu (Bắt buộc theo yêu cầu đề bài):**
  Vào mục **Explore** (biểu tượng la bàn bên trái) -> Chọn Data source là **Loki**:

  **Query 1 — Lọc các lượt đăng nhập thành công vào hệ thống:**
  ```logql
  {compose_service="backend"} |= "Login success"
  ```

  **Query 2 — Lọc nhật ký các lần điểm danh bằng khuôn mặt (Check-in/Check-out):**
  ```logql
  {compose_service="backend"} |= "face_check"
  ```

  **Query 3 — Bóc tách JSON log và lọc toàn bộ lỗi hệ thống (Level error):**
  ```logql
  {compose_service="backend"} | json | level="error"
  ```

  *(Chụp lại ảnh màn hình kết quả 3 câu query này để đưa vào báo cáo tổng kết).*

---

## Bước 8: Kế hoạch 3 Commit Git chuẩn để nộp bài đạt điểm tối đa

Để đạt trọn vẹn **1.5 điểm tiêu chí Quản lý mã nguồn trên GitHub** (yêu cầu ít nhất 3 commit rõ ràng và có ý nghĩa mang tên `dtc245160039-max`), sinh viên thực hiện commit theo trình tự sau:

### Commit 1: Khởi tạo ứng dụng, CSDL MySQL 8.0, phpMyAdmin và Nginx Reverse Proxy
```bash
git checkout -b main
git add backend/ frontend/ db/ docker-compose.yml nginx/ scripts/gen-certs.sh .env.example .gitignore openssl.cnf
git commit -m "feat(core): initial Attendance application stack, MySQL 8.0, phpMyAdmin and Nginx reverse proxy with SSL"
```
*Nội dung: Mã nguồn web, API backend Node.js, CSDL MySQL 8.0 (init.sql), phpMyAdmin và cấu hình Nginx reverse proxy HTTPS + security headers.*

### Commit 2: Tích hợp hệ thống giám sát Prometheus, Grafana và Hardening bảo mật
```bash
git add monitoring/prometheus/ monitoring/grafana/ docker-compose.monitoring.yml scripts/
git commit -m "feat(monitoring): integrate Prometheus and Grafana dashboards with container and mysqld exporters"
```
*Nội dung: Cấu hình Prometheus, mysqld-exporter, cadvisor, node-exporter, Dashboard Grafana giám sát tài nguyên và các biện pháp network isolation/least-privilege hardening.*

### Commit 3: Tích hợp ghi log tập trung Loki, Promtail, phân quyền Kiosk và hoàn thiện tài liệu
```bash
git add monitoring/loki/ monitoring/promtail/ README.md Huong_Dan_Trien_Khai_Ubuntu_Server.md
git commit -m "feat(logging): central logging with Loki and Promtail, LogQL queries and kiosk mode security"
```
*Nội dung: Cấu hình Loki, Promtail, tài khoản Kiosk cửa ra vào, hoàn thiện file README và hướng dẫn triển khai máy ảo.*

Đẩy toàn bộ lên GitHub:
```bash
git remote set-url origin https://github.com/dtc245160039-max/dtc245160039-De27-HeThongDiemDanh.git
git push -u origin main
```

---

## 11. Xử lý sự cố thường gặp (Troubleshooting) & Vận hành định kỳ

### 11.1. Trình duyệt báo lỗi kết nối Webcam (NotAllowedError hoặc DevicesNotFoundError)
- **Nguyên nhân:** Trình duyệt hiện đại (Chrome, Edge, Firefox) chỉ cho phép mở Camera qua kết nối **HTTPS** hoặc `http://localhost`.
- **Khắc phục:** Luôn truy cập qua `https://<IP_UBUNTU>`. Khi trình duyệt hiển thị cảnh báo chứng chỉ tự ký ("Kết nối của bạn không phải là kết nối riêng tư"), hãy bấm **Nâng cao (Advanced)** -> Chọn **Tiếp tục truy cập (Proceed to IP...)**.

### 11.2. Khởi động lại hoặc dừng toàn bộ hệ thống
```bash
# Dừng toàn bộ hệ thống (dữ liệu CSDL MySQL vẫn được lưu an toàn trong Docker Volume)
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml down

# Khởi động lại toàn bộ
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

### 11.3. Tự động sao lưu CSDL hàng ngày (Database Backup Automation)
Hệ thống có sẵn script sao lưu MySQL tại `scripts/backup_db.sh`.
Thiết lập chạy tự động lúc 02:00 sáng mỗi ngày bằng Crontab trên Ubuntu:
```bash
crontab -e
```
Thêm dòng sau vào cuối file:
```cron
0 2 * * * /bin/bash /home/ubuntu/dtc245160039-De27-HeThongDiemDanh/scripts/backup_db.sh >> /var/log/attendance_backup.log 2>&1
```

### 11.4. Kiểm tra tài nguyên tiêu thụ của các container
```bash
docker stats
```
Lệnh này hiển thị phần trăm CPU, lượng RAM đang dùng của từng container theo thời gian thực để đảm bảo máy chủ không bị quá tải.

---
*(Tài liệu này được lưu trữ phục vụ việc triển khai thực hành và nghiệm thu đề tài môn Triển khai và Quản trị Hệ thống Phần mềm — Đề 27: DTC245160039).*
