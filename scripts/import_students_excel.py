#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script: import_students_excel.py
Mục đích: Đọc danh sách sinh viên từ file Excel (.xlsx, .xls) hoặc CSV
          và nhập tự động vào hệ thống Điểm danh (Đề 27) - DTC245160039.
Sử dụng:
    python scripts/import_students_excel.py <duong_dan_file_excel> [--api-url http://localhost:3000] [--default-class "CNTT K24A"]
"""

import sys
import os
import argparse
import re

# Đảm bảo in tiếng Việt có dấu an toàn trên Windows cmd / powershell
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import pandas as pd
import requests

DEFAULT_API_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
DEFAULT_ADMIN_USER = os.getenv("ADMIN_USERNAME", "admin")
DEFAULT_ADMIN_PASS = os.getenv("ADMIN_PASSWORD", "Admin@Attendance2024!")

def normalize_key(k: str) -> str:
    """Chuẩn hóa tiêu đề cột sang chữ thường không dấu để tự động nhận diện."""
    k = str(k).strip().lower()
    # Loại bỏ dấu tiếng Việt cơ bản
    trans = str.maketrans(
        "áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ",
        "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd"
    )
    k = k.translate(trans)
    k = re.sub(r'[^a-z0-9]', '', k)
    return k

def map_columns(df: pd.DataFrame) -> dict:
    """Tự động ánh xạ các cột trong file Excel vào thuộc tính Sinh viên."""
    col_mapping = {
        'code': None,
        'full_name': None,
        'department': None,
        'email': None,
        'phone': None,
        'position': None,
        'shift': None,
    }

    for col in df.columns:
        norm = normalize_key(col)
        # Mã sinh viên
        if any(w in norm for w in ['masv', 'mssv', 'masinhvien', 'manv', 'code', 'id']):
            if not col_mapping['code']:
                col_mapping['code'] = col
        # Họ và tên
        elif any(w in norm for w in ['hoten', 'hovaten', 'tensinhvien', 'fullname', 'name']):
            if not col_mapping['full_name']:
                col_mapping['full_name'] = col
        # Lớp học / Khoa
        elif any(w in norm for w in ['lop', 'lophoc', 'khoa', 'nganh', 'department', 'class']):
            if not col_mapping['department']:
                col_mapping['department'] = col
        # Email
        elif any(w in norm for w in ['email', 'mail']):
            if not col_mapping['email']:
                col_mapping['email'] = col
        # Số điện thoại
        elif any(w in norm for w in ['sdt', 'sodienthoai', 'dienthoai', 'phone', 'tel']):
            if not col_mapping['phone']:
                col_mapping['phone'] = col
        # Chức vụ
        elif any(w in norm for w in ['chucvu', 'vaitro', 'position', 'role', 'bancansu']):
            if not col_mapping['position']:
                col_mapping['position'] = col
        # Ca học
        elif any(w in norm for w in ['cahoc', 'tiethoc', 'ca', 'shift']):
            if not col_mapping['shift']:
                col_mapping['shift'] = col

    return col_mapping

def login_admin(api_url: str, username: str, password: str) -> str:
    """Đăng nhập lấy JWT Token quản trị viên."""
    url = f"{api_url.rstrip('/')}/api/v1/auth/login"
    try:
        res = requests.post(url, json={"username": username, "password": password}, timeout=5)
        if res.status_code == 200:
            data = res.json()
            return data.get('data', {}).get('token')
        else:
            print(f"[!] Đăng nhập thất bại: {res.text}")
            return None
    except Exception as e:
        print(f"[!] Không kết nối được tới máy chủ API ({url}): {e}")
        return None

def get_or_create_department(api_url: str, token: str, dept_name: str, cache: dict) -> int:
    """Lấy department_id theo tên lớp, nếu chưa có thì tự động tạo mới."""
    if not dept_name:
        dept_name = "Lớp Công nghệ Thông tin K24A"
    clean_name = str(dept_name).strip()
    if clean_name in cache:
        return cache[clean_name]

    headers = {"Authorization": f"Bearer {token}"}
    # Lấy danh sách hiện tại
    try:
        r = requests.get(f"{api_url.rstrip('/')}/api/v1/departments", headers=headers, timeout=5)
        if r.status_code == 200:
            depts = r.json().get('data', [])
            for d in depts:
                cache[d['name'].strip().lower()] = d['id']
                if d['name'].strip().lower() == clean_name.lower():
                    return d['id']
    except Exception as e:
        print(f"[!] Lỗi truy vấn lớp học: {e}")

    # Tạo mới lớp học
    try:
        create_res = requests.post(f"{api_url.rstrip('/')}/api/v1/departments", headers=headers, json={
            "name": clean_name,
            "description": f"Lớp sinh viên {clean_name} - Tự động tạo từ danh sách Excel"
        }, timeout=5)
        if create_res.status_code in [200, 201]:
            new_id = create_res.json().get('data', {}).get('id')
            cache[clean_name.lower()] = new_id
            print(f" [+] Đã tự động tạo Lớp học mới: '{clean_name}' (ID: {new_id})")
            return new_id
    except Exception as e:
        print(f"[!] Lỗi tạo lớp học: {e}")

    return None

def import_file(file_path: str, api_url: str = DEFAULT_API_URL, default_class: str = "Lớp CNTT K24A"):
    if not os.path.exists(file_path):
        print(f"[X] Không tìm thấy file: {file_path}")
        return

    print(f"[*] Đang đọc dữ liệu từ: {file_path}")
    ext = os.path.splitext(file_path)[1].lower()
    if ext in ['.xlsx', '.xls']:
        df = pd.read_excel(file_path)
    elif ext == '.csv':
        df = pd.read_csv(file_path, encoding='utf-8-sig')
    else:
        print(f"[X] Định dạng tệp '{ext}' không được hỗ trợ. Vui lòng cung cấp file .xlsx, .xls hoặc .csv!")
        return

    print(f"[*] Tổng số dòng tìm thấy trong tệp: {len(df)}")
    mapping = map_columns(df)
    print(f"[*] Tự động nhận diện cột:")
    for k, v in mapping.items():
        print(f"    - {k}: '{v}'" if v else f"    - {k}: (Không có - dùng mặc định)")

    if not mapping['full_name'] and not mapping['code']:
        print("[X] File không chứa cột Tên hoặc Mã sinh viên hợp lệ!")
        return

    # Kết nối API
    token = login_admin(api_url, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS)
    if not token:
        print("[!] Không kết nối được API trực tiếp. Chuyển sang xuất tệp SQL import dự phòng...")
        export_sql_backup(df, mapping, default_class)
        return

    headers = {"Authorization": f"Bearer {token}"}
    dept_cache = {}

    success_count = 0
    skip_count = 0

    print("\n[*] Đang nạp danh sách sinh viên vào hệ thống...")
    for idx, row in df.iterrows():
        # Lấy MSSV
        code = str(row[mapping['code']]).strip() if mapping['code'] and pd.notna(row[mapping['code']]) else f"SV{idx+1:04d}"
        if code.endswith('.0'): # Xử lý trường hợp excel coi mã là số float
            code = code[:-2]

        # Họ tên
        full_name = str(row[mapping['full_name']]).strip() if mapping['full_name'] and pd.notna(row[mapping['full_name']]) else f"Sinh viên {code}"
        
        # Lớp
        dept_name = str(row[mapping['department']]).strip() if mapping['department'] and pd.notna(row[mapping['department']]) else default_class
        dept_id = get_or_create_department(api_url, token, dept_name, dept_cache)

        # Email
        email = str(row[mapping['email']]).strip() if mapping['email'] and pd.notna(row[mapping['email']]) else f"{code.lower()}@ictu.edu.vn"

        # SĐT
        phone = str(row[mapping['phone']]).strip() if mapping['phone'] and pd.notna(row[mapping['phone']]) else None
        if phone and phone.endswith('.0'):
            phone = phone[:-2]

        # Chức vụ
        position = str(row[mapping['position']]).strip() if mapping['position'] and pd.notna(row[mapping['position']]) else "Sinh viên"

        # Ca học
        shift_name = str(row[mapping['shift']]).strip() if mapping['shift'] and pd.notna(row[mapping['shift']]) else "Ca sáng (Tiết 1 - 4: 07:00 - 10:30)"

        payload = {
            "employee_code": code,
            "full_name": full_name,
            "department_id": dept_id,
            "email": email,
            "phone": phone,
            "position": position,
            "shift_name": shift_name,
            "work_start": "07:00",
            "work_end": "10:30",
            "status": "active"
        }

        try:
            r = requests.post(f"{api_url.rstrip('/')}/api/v1/employees", headers=headers, json=payload, timeout=5)
            if r.status_code in [200, 201]:
                success_count += 1
                print(f"  [{success_count:02d}] Đã thêm: {code} - {full_name} ({dept_name})")
            else:
                err_msg = r.json().get('message', r.text)
                print(f"  [!] Bỏ qua {code} ({full_name}): {err_msg}")
                skip_count += 1
        except Exception as e:
            print(f"  [X] Lỗi gửi API cho {code}: {e}")
            skip_count += 1

    print("\n" + "="*50)
    print(f"KẾT QUẢ IMPORT DANH SÁCH SINH VIÊN:")
    print(f"  - Thành công: {success_count} sinh viên")
    print(f"  - Bỏ qua/Lỗi: {skip_count} dòng")
    print("="*50)

def export_sql_backup(df, mapping, default_class):
    """Xuất câu lệnh SQL để nạp trực tiếp vào MySQL nếu backend chưa chạy."""
    sql_file = "db/imported_students.sql"
    with open(sql_file, "w", encoding="utf-8") as f:
        f.write("-- Dữ liệu sinh viên import từ file Excel\n")
        f.write("USE attendance_db;\n\n")
        for idx, row in df.iterrows():
            code = str(row[mapping['code']]).strip() if mapping['code'] and pd.notna(row[mapping['code']]) else f"SV{idx+1:04d}"
            if code.endswith('.0'): code = code[:-2]
            name = str(row[mapping['full_name']]).strip() if mapping['full_name'] and pd.notna(row[mapping['full_name']]) else f"Sinh viên {code}"
            email = str(row[mapping['email']]).strip() if mapping['email'] and pd.notna(row[mapping['email']]) else f"{code.lower()}@ictu.edu.vn"
            f.write(f"INSERT INTO employees (employee_code, full_name, email, department_id, position, shift_name, work_start, work_end, status) "
                    f"VALUES ('{code}', '{name}', '{email}', 1, 'Sinh viên', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)', '07:00:00', '10:30:00', 'active') "
                    f"ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);\n")
    print(f"[OK] Đã xuất {len(df)} dòng dữ liệu ra file SQL dự phòng: {sql_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Nhập danh sách sinh viên từ Excel/CSV vào Hệ thống Điểm danh")
    parser.add_argument("file", help="Đường dẫn tới tệp Excel (.xlsx, .xls) hoặc CSV")
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="URL API Backend (mặc định: http://localhost:3000)")
    parser.add_argument("--default-class", default="Lớp CNTT K24A", help="Tên lớp mặc định nếu file không có cột lớp")

    args = parser.parse_args()
    import_file(args.file, args.api_url, args.default_class)
