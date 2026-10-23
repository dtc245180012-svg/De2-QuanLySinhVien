# HƯỚNG DẪN CHI TIẾT DÙNG FILEZILLA CHUYỂN TOÀN BỘ CODE SANG MÁY ẢO UBUNTU SERVER ĐỂ TRIỂN KHAI

> **Đề tài:** Đề 27 — Hệ thống Điểm danh Sinh viên (Trường ĐH CNTT & Truyền thông - ICTU)  
> **Sinh viên thực hiện:** DTC245160039  
> **Email:** dtc245160039@ictu.edu.vn  
> **GitHub:** [dtc245160039-max/dtc245160039-De27-HeThongDiemDanh](https://github.com/dtc245160039-max/dtc245160039-De27-HeThongDiemDanh)  
> **Mục tiêu:** Hướng dẫn từng bước từ máy tính thật (Windows) dùng FileZilla kết nối SFTP sang máy ảo Ubuntu Server, chuyển mã nguồn và khởi động hệ thống chạy bằng Docker Compose.

---

## 📑 TỔNG QUAN CÁC BƯỚC THỰC HIỆN

```
[ BƯỚC 1: UBUNTU ]  ────────► [ BƯỚC 2: FILEZILLA ] ────────► [ BƯỚC 3: UBUNTU ]  ────────► [ BƯỚC 4: CLIENT ]
Cài SSH & Lấy IP             Kết nối SFTP (Port 22)        Cấu hình .env & SSL           Mở Web browser
Kiểm tra Firewall            Upload toàn bộ thư mục code   Chạy Docker Compose           Điểm danh & Giám sát
```

---

## BƯỚC 1: CHUẨN BỊ TRÊN MÁY ẢO UBUNTU SERVER

Mở màn hình terminal máy ảo Ubuntu Server và thực hiện các lệnh sau:

### 1.1. Cập nhật hệ thống và cài đặt OpenSSH Server
Để FileZilla kết nối được với Ubuntu, máy ảo cần có dịch vụ SSH:
```bash
sudo apt update
sudo apt install -y openssh-server curl git ufw
sudo systemctl enable ssh
sudo systemctl start ssh
```

Kiểm tra trạng thái SSH đang chạy (hiện `active (running)` là thành công):
```bash
sudo systemctl status ssh
```

### 1.2. Xác định địa chỉ IP của máy ảo Ubuntu
Chạy lệnh:
```bash
hostname -I
```
*Ghi nhớ địa chỉ IP này (ví dụ: `192.168.1.50` hoặc `192.168.100.25`). Đây chính là địa chỉ IP bạn sẽ nhập vào FileZilla.*

> [!TIP]
> **Khuyên dùng Card mạng Bridged Adapter:**  
> Trong cài đặt máy ảo (VMware / VirtualBox), hãy chọn Network là **Bridged Adapter** để máy ảo nhận cùng dải mạng với máy Windows. Nếu dùng NAT, bạn cần cấu hình Port Forwarding cổng 22, 80, 443, 3001, 9090.

### 1.3. Cài đặt Docker & Docker Compose Plugin (nếu chưa cài)
```bash
# Thêm Docker GPG key & Repo
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Phân quyền chạy Docker không cần sudo
sudo usermod -aG docker $USER
newgrp docker
```

---

## BƯỚC 2: CẤU HÌNH FILEZILLA TRÊN WINDOWS & CHUYỂN CODE

### 2.1. Tải và cài đặt FileZilla Client (nếu chưa có)
- Tải từ trang chủ: [https://filezilla-project.org/download.php?type=client](https://filezilla-project.org/download.php?type=client)
- Cài đặt bình thường (Next -> Next -> Finish).

### 2.2. Hiển thị tệp tin ẩn trong FileZilla (BẮT BUỘC)
Trong dự án có các file cấu hình quan trọng có dấu chấm ở đầu (như `.env.example`, `.gitignore`). Hãy bật tính năng hiển thị file ẩn:
1. Mở FileZilla.
2. Trên thanh menu trên cùng, chọn: **Server (Máy chủ)** → tích chọn **Force showing hidden files (Bắt buộc hiện tập tin ẩn)**.

### 2.3. Kết nối SFTP vào máy ảo Ubuntu
Trên thanh **Quickconnect (Kết nối nhanh)** ở đầu giao diện FileZilla, điền:

| Ô nhập liệu | Giá trị cần điền | Ghi chú |
|---|---|---|
| **Host (Máy chủ)** | `sftp://<ĐỊA_CHỈ_IP_UBUNTU>` *(hoặc gõ thẳng IP, ví dụ `192.168.1.50`)* | IP lấy từ lệnh `hostname -I` ở Bước 1 |
| **Username (Tên đăng nhập)** | Tên user Ubuntu của bạn *(ví dụ: `ubuntu`)* | User bạn đăng nhập máy ảo |
| **Password (Mật khẩu)** | Mật khẩu user Ubuntu của bạn | Mật khẩu đăng nhập máy ảo |
| **Port (Cổng)** | `22` | Cổng SFTP chuẩn qua SSH |

Bấm nút **Quickconnect (Kết nối nhanh)**.

> [!NOTE]
> Lần đầu kết nối, FileZilla sẽ hiện cửa sổ cảnh báo **"Unknown host key" (Khóa máy chủ không xác định)**.  
> Hãy tích chọn ô **"Always trust this host, add this key to the cache" (Luôn tin cậy máy chủ này)** → bấm **OK**.

Khi góc trạng thái hiện:  
`Status: Directory listing of "/home/<username>" successful`  
Nghĩa là bạn đã kết nối thành công!

---

### 2.4. Thao tác sao chép toàn bộ dự án sang Ubuntu

Giao diện FileZilla chia làm 2 bên:
- **Bên trái (Local site - Máy tính của bạn)**:
  - Nhập đường dẫn đến thư mục dự án: `d:\Du An\De27-DiemDanhSinhVien`
  - Bạn sẽ thấy toàn bộ các file: `backend`, `frontend`, `db`, `nginx`, `monitoring`, `scripts`, `docker-compose.yml`, `.env.example`, `DS KHMT K23A.xlsx`, `DS KTPM K23A.xlsx`...

- **Bên phải (Remote site - Máy ảo Ubuntu)**:
  - Hiện đang ở: `/home/<tên_user_của_bạn>/`
  - Bấm chuột phải vào khoảng trống bên phải → chọn **Create directory (Tạo thư mục)** → đặt tên là:
    ```
    dtc245160039-De27-HeThongDiemDanh
    ```
  - Bấm đúp chuột để vào bên trong thư mục `dtc245160039-De27-HeThongDiemDanh` vừa tạo.

- **Thực hiện Copy**:
  - Ở khung **bên trái**, bấm phím `Ctrl + A` để bôi đen chọn tất cả các file và thư mục.
  - Kéo chuột (Drag & Drop) toàn bộ sang khung **bên phải** (hoặc bấm chuột phải → chọn **Upload**).
  - Thanh tiến trình phía dưới (*Queued files*) sẽ tải lên toàn bộ dữ liệu.
  - Chờ khoảng 30 giây đến 1 phút đến khi thanh tiến trình báo `Successful transfers: ... files` (0 failed).

---

## BƯỚC 3: THIẾT LẬP VÀ CHẠY HỆ THỐNG TRÊN UBUNTU SERVER

Quay trở lại cửa sổ dòng lệnh Terminal trên máy ảo Ubuntu (hoặc mở PowerShell trên Windows gõ `ssh <user>@<IP_UBUNTU>`):

### 3.1. Di chuyển vào thư mục dự án vừa upload
```bash
cd ~/dtc245160039-De27-HeThongDiemDanh
ls -la
```
*Bạn sẽ thấy đầy đủ toàn bộ file mã nguồn, thư mục, file Excel và các file `.env.example`, `docker-compose.yml`.*

### 3.2. Cấu hình biến môi trường `.env`
Tạo file cấu hình `.env` từ file mẫu:
```bash
cp .env.example .env
```
*(Nếu muốn đổi mật khẩu CSDL hoặc cấu hình IP máy chủ, bạn có thể chỉnh sửa bằng lệnh `nano .env`).*

### 3.3. Cấp quyền thực thi cho các script hệ thống
Trên Linux, các file `.sh` từ Windows đưa sang cần được cấp quyền thực thi `+x`:
```bash
chmod +x scripts/*.sh
```
*Mẹo phòng ngừa lỗi ký tự xuống dòng Windows (CRLF):*
```bash
sed -i 's/\r$//' scripts/*.sh
```

### 3.4. Sinh chứng chỉ SSL/TLS có gắn địa chỉ IP máy ảo
Hệ thống sử dụng HTTPS với Nginx Reverse Proxy. Hãy chạy script tự động sinh chứng chỉ có gắn IP máy ảo Ubuntu (thay `<IP_UBUNTU>` bằng IP thật, ví dụ `192.168.1.50`):
```bash
bash scripts/gen-certs.sh $(hostname -I | awk '{print $1}')
```
*Script sẽ tự động tạo `cert.pem` và `key.pem` chuẩn trong thư mục `nginx/certs/` với Subject Alternative Name (SAN) chứa IP máy ảo.*

### 3.5. Khởi động toàn bộ Hệ thống bằng Docker Compose

Chạy lệnh duy nhất để build và khởi động toàn bộ **12 container** (Stack ứng dụng chính + Stack giám sát & log tập trung):

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d --build
```

> [!NOTE]
> Lần đầu khởi động, Docker sẽ build image cho `backend` và `frontend`, đồng thời kéo các image MySQL 8.0, phpMyAdmin, Prometheus, Grafana, Loki, Promtail... Thời gian khoảng 2 - 3 phút tùy tốc độ mạng.

### 3.6. Kiểm tra trạng thái hoạt động của các container
Chạy lệnh:
```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml ps
```
**Yêu cầu đạt chuẩn:** Tất cả 12 container đều phải ở trạng thái **`Up`** (hoặc `running`):
1. `attendance_proxy` (Nginx HTTPS: 80, 443)
2. `attendance_frontend` (Port 8080)
3. `attendance_backend` (Node.js API: Port 3000)
4. `attendance_db` (MySQL 8.0: Port 3306)
5. `attendance_phpmyadmin` (phpMyAdmin)
6. `attendance_prometheus` (Prometheus: Port 9090)
7. `attendance_grafana` (Grafana Dashboard: Port 3001)
8. `attendance_loki` (Loki Log server: Port 3100)
9. `attendance_promtail` (Promtail log collector)
10. `attendance_mysqld_exporter` (MySQL exporter: Port 9104)
11. `attendance_node_exporter` (Host exporter: Port 9100)
12. `attendance_cadvisor` (Container metrics: Port 8081)

Xem log thời gian thực nếu cần:
```bash
docker compose logs -f backend
```

---

## BƯỚC 4: TRUY CẬP VÀ KIỂM THỬ HỆ THỐNG TỪ MÁY TÍNH THẬT

Mở trình duyệt Web trên máy Windows (Chrome, Edge hoặc Firefox) và nhập các địa chỉ sau (thay `<IP_UBUNTU>` bằng IP máy ảo):

### 4.1. Giao diện Web Điểm danh Sinh viên (Chính)
- **Địa chỉ:** `https://<IP_UBUNTU>` (Ví dụ: `https://192.168.1.50`)
- **Lưu ý SSL:** Vì chứng chỉ HTTPS là tự ký (Self-signed), trình duyệt sẽ hiện cảnh báo bảo mật. Bấm **Nâng cao (Advanced)** → chọn **Tiếp tục truy cập (Proceed to <IP> unsafe)**.

#### Danh sách tài khoản đăng nhập mẫu:

| Phân hệ / Vai trò | Tên đăng nhập | Mật khẩu | Quyền hạn & Chức năng |
|---|---|---|---|
| **Quản trị viên (Admin)** | `admin` | `Admin@Attendance2024!` | Toàn quyền quản lý sinh viên (118 SV cả 2 lớp KHMT & KTPM), phân ca học, xem thống kê, import Excel |
| **Giáo vụ Quản lý Lớp (HR)** | `hr01` *(hoặc `giaovu`)* | `Hr@Attendance2024!` | Quản lý danh sách sinh viên, ca học và điểm danh thủ công |
| **Sinh viên (KHMT K23A)** | `dtc245160039` | `Dtc245160039@2024!` | Tra cứu lịch sử điểm danh của sinh viên Đàm Đức Lương |
| **Sinh viên (KTPM K23A)** | `dtc245180148` | `Dtc245180148@2024!` | Tra cứu lịch sử điểm danh của sinh viên Nguyễn Quốc Anh |
| **Máy Điểm Danh Cửa Lớp (Kiosk)** | `chamcong` *(hoặc `kiosk`)* | `Chamcong@2024!` | Chế độ Kiosk: Mở camera quẹt mặt điểm danh, tự động khóa trang quản trị |

---

### 4.2. Giao diện Quản trị CSDL phpMyAdmin
- **Địa chỉ:** `https://<IP_UBUNTU>/phpmyadmin/`
- **Tài khoản:** `attendance_user`
- **Mật khẩu:** `ChangeMe_MySQL_2024!_mY8s`  
*(hoặc user `root` với mật khẩu: `RootPassword_Secure_2024!_rT9p`)*
- Vào CSDL `attendance_db` → bảng `employees`: Bạn sẽ thấy sẵn sàng **118 sinh viên** của 2 lớp `KHMT K23A` (62 SV) và `KTPM K23A` (56 SV).

---

### 4.3. Bảng điều khiển Giám sát Prometheus
- **Địa chỉ:** `http://<IP_UBUNTU>:9090`
- Vào menu **Status** → **Targets**: Đảm bảo 4 target `attendance-backend`, `mysqld-exporter`, `node-exporter`, `cadvisor` đều hiển thị **UP (màu xanh)**.

---

### 4.4. Bảng điều khiển Grafana & Truy vấn LogQL
- **Địa chỉ:** `http://<IP_UBUNTU>:3001`
- **Tài khoản:** `admin` / `ChangeMe_Grafana_2024!_gR5t`
- Vào menu **Dashboards** → mở **"Attendance - System Overview"** để quan sát:
  - CPU & RAM các container Docker
  - Hiệu năng MySQL (threads, queries, uptime)
  - Dung lượng ổ cứng máy chủ Ubuntu
- Vào menu **Explore** → chọn nguồn dữ liệu **Loki** để chạy 3 câu LogQL mẫu:
  1. Lọc đăng nhập thành công: `{compose_service="backend"} |= "Login success"`
  2. Lọc lượt điểm danh khuôn mặt: `{compose_service="backend"} |= "face_check"`
  3. Lọc lỗi hệ thống: `{compose_service="backend"} | json | level="error"`

---

## ⚠️ CÁC LỖI THƯỜNG GẶP KHI DÙNG FILEZILLA & CÁCH XỬ LÝ (TROUBLESHOOTING)

### Lỗi 1: FileZilla báo "Connection refused" hoặc "Connection timed out"
- **Nguyên nhân:** Máy ảo Ubuntu chưa bật SSH hoặc địa chỉ IP bị sai, hoặc tường lửa chặn cổng 22.
- **Cách sửa:**
  - Trên Ubuntu chạy: `sudo systemctl restart ssh`
  - Tắt tạm firewall để kiểm tra: `sudo ufw disable`
  - Đảm bảo máy thật ping được sang Ubuntu: trên Windows gõ `ping <IP_UBUNTU>`.

### Lỗi 2: FileZilla báo "Permission denied" khi tải tệp lên
- **Nguyên nhân:** Bạn đang tải file vào thư mục mà user không có quyền ghi (ví dụ `/var/www/` hoặc `/root/`).
- **Cách sửa:** Luôn tải vào thư mục người dùng cá nhân: `/home/<tên_user_của_bạn>/dtc245160039-De27-HeThongDiemDanh`.

### Lỗi 3: Không thấy file `.env.example` trên FileZilla
- **Nguyên nhân:** File có dấu chấm ở đầu bị ẩn theo mặc định.
- **Cách sửa:** Trên thanh menu FileZilla chọn **Server** → tích vào **Force showing hidden files**.

### Lỗi 4: Không mở được Camera điểm danh trên Web
- **Nguyên nhân:** Trình duyệt Chrome/Edge chỉ cho phép truy cập Camera/Webcam qua kết nối an toàn (HTTPS hoặc localhost). Nếu truy cập qua IP bằng HTTP thường (`http://IP`), trình duyệt sẽ chặn webcam.
- **Cách sửa:** Luôn truy cập qua giao diện HTTPS: `https://<IP_UBUNTU>` (Nginx Reverse Proxy đã cấu hình sẵn chứng chỉ SSL tự ký cho bạn).

### Lỗi 5: Cổng 80 hoặc 3306 bị trùng với dịch vụ có sẵn trên Ubuntu
- **Nguyên nhân:** Máy ảo đã cài Apache (`apache2`) hoặc MySQL ngoài máy chủ từ trước.
- **Cách sửa:**
  ```bash
  sudo systemctl stop apache2 mysql
  sudo systemctl disable apache2 mysql
  ```
  Sau đó khởi động lại Docker Compose:
  ```bash
  docker compose -f docker-compose.yml -f docker-compose.monitoring.yml restart
  ```

---

## 🎯 TỔNG KẾT CÁC LỆNH CẦN CHẠY TRÊN UBUNTU (QUICK CHEATSHEET)

```bash
# 1. Sau khi dùng FileZilla upload xong, vào thư mục:
cd ~/dtc245160039-De27-HeThongDiemDanh

# 2. Tạo .env & cấp quyền script:
cp .env.example .env
chmod +x scripts/*.sh
sed -i 's/\r$//' scripts/*.sh

# 3. Tạo chứng chỉ SSL gắn IP máy ảo:
bash scripts/gen-certs.sh $(hostname -I | awk '{print $1}')

# 4. Khởi động 12 container Docker:
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d --build

# 5. Kiểm tra trạng thái:
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml ps
```
