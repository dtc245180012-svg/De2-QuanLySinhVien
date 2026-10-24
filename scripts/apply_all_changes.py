# -*- coding: utf-8 -*-
import os
import sys
import re
import zipfile
import shutil

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

OLD_INFO = {
    'mssv': 'DTC245160039',
    'mssv_lower': 'dtc245160039',
    'name': 'Đàm Đức Lương',
    'email': 'dtc245160039@ictu.edu.vn',
    'class': 'Khoa học Máy tính K23A (KHMT K23A)',
    'class_short': 'KHMT K23A',
    'github_user': 'dtc245160039-max',
    'repo_name': 'dtc245160039-De27-HeThongDiemDanh',
    'repo_url': 'https://github.com/dtc245160039-max/dtc245160039-De27-HeThongDiemDanh',
    'topic': 'Đề 27: Hệ thống Điểm danh Sinh viên',
    'topic_full': 'ĐỀ TÀI SỐ 27: THIẾT KẾ, TRIỂN KHAI VÀ QUẢN TRỊ HỆ THỐNG ĐIỂM DANH SINH VIÊN TRÊN NỀN TẢNG CONTAINER VÀ ĐIỆN TOÁN ĐÁM MÂY',
}

NEW_INFO = {
    'mssv': 'DTC245180012',
    'mssv_lower': 'dtc245180012',
    'name': 'Ngô Hoàng Lan',
    'email': 'dtc245180012@ictu.edu.vn',
    'class': 'Kỹ thuật Phần mềm K23A (KTPM K23A)',
    'class_short': 'KTPM K23A',
    'instructor': 'TS. Hoàng Văn Tâm',
    'github_user': 'dtc245180012-svg',
    'repo_name': 'De2-QuanLySinhVien',
    'repo_url': 'https://github.com/dtc245180012-svg/De2-QuanLySinhVien',
    'clone_url': 'https://github.com/dtc245180012-svg/De2-QuanLySinhVien.git',
    'topic': 'Đề 2: Hệ thống Quản lý Sinh viên',
    'topic_full': 'ĐỀ TÀI SỐ 02: THIẾT KẾ, TRIỂN KHAI VÀ QUẢN TRỊ HỆ THỐNG QUẢN LÝ SINH VIÊN TRÊN NỀN TẢNG CONTAINER VÀ ĐIỆN TOÁN ĐÁM MÂY',
}

def update_text_file(filepath):
    if not os.path.isfile(filepath):
        return
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    original = content

    # Replace specific URLs and names first
    content = content.replace('https://github.com/dtc245160039-max/dtc245160039-De27-HeThongDiemDanh.git', NEW_INFO['clone_url'])
    content = content.replace('https://github.com/dtc245160039-max/dtc245160039-De27-HeThongDiemDanh', NEW_INFO['repo_url'])
    content = content.replace('dtc245160039-max/dtc245160039-De27-HeThongDiemDanh', f"{NEW_INFO['github_user']}/{NEW_INFO['repo_name']}")
    content = content.replace('dtc245160039-De27-HeThongDiemDanh', NEW_INFO['repo_name'])
    content = content.replace('dtc245160039-max', NEW_INFO['github_user'])
    content = content.replace('dtc245160039@ictu.edu.vn', NEW_INFO['email'])
    content = content.replace('dtc245160039', NEW_INFO['mssv_lower'])
    content = content.replace('DTC245160039', NEW_INFO['mssv'])
    content = content.replace('Đàm Đức Lương', NEW_INFO['name'])
    
    # Also replace old Le Van Duc occurrences if any in docs
    content = content.replace('dtc245160004@ictu.edu.vn', NEW_INFO['email'])
    content = content.replace('DTC245160004', NEW_INFO['mssv'])
    content = content.replace('dtc245160004', NEW_INFO['mssv_lower'])

    if content != original:
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            f.write(content)
        print(f"[OK] Updated text file: {os.path.relpath(filepath, ROOT_DIR)}")

def update_markdown_headers():
    # 1. README.md
    readme_path = os.path.join(ROOT_DIR, 'README.md')
    if os.path.isfile(readme_path):
        with open(readme_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        new_lines = []
        for line in lines:
            if line.startswith('# ĐỀ 27:'):
                line = '# ĐỀ 02: HỆ THỐNG QUẢN LÝ SINH VIÊN (STUDENT MANAGEMENT SYSTEM)\n'
            elif '**Sinh viên thực hiện:**' in line:
                line = f'> **Sinh viên thực hiện:** {NEW_INFO["name"]}  \n'
            elif '**Mã số sinh viên (MSSV):**' in line:
                line = f'> **Mã số sinh viên (MSSV):** {NEW_INFO["mssv"]}  \n'
            elif '**Lớp chuyên ngành:**' in line:
                line = f'> **Lớp chuyên ngành:** {NEW_INFO["class"]}  \n'
            elif '**Email:**' in line and 'ictu.edu.vn' in line:
                line = f'> **Email:** `{NEW_INFO["email"]}`  \n'
            elif '**GitHub Repository:**' in line:
                line = f'> **GitHub Repository:** [{NEW_INFO["github_user"]}/{NEW_INFO["repo_name"]}]({NEW_INFO["repo_url"]})  \n'
            new_lines.append(line)
        with open(readme_path, 'w', encoding='utf-8', newline='') as f:
            f.writelines(new_lines)
        update_text_file(readme_path)
        print("[OK] README.md headers updated.")

    # 2. Bao_Cao_Tong_Hop_De27.md
    bc_path = os.path.join(ROOT_DIR, 'Bao_Cao_Tong_Hop_De27.md')
    if os.path.isfile(bc_path):
        with open(bc_path, 'r', encoding='utf-8') as f:
            c = f.read()
        
        # update cover block
        c = re.sub(r'## ĐỀ TÀI SỐ 27:[\r\n]+# THIẾT KẾ[^\r\n]+',
                   f"## ĐỀ TÀI SỐ 02:\n# THIẾT KẾ, TRIỂN KHAI VÀ QUẢN TRỊ HỆ THỐNG QUẢN LÝ SINH VIÊN TRÊN NỀN TẢNG CONTAINER VÀ ĐIỆN TOÁN ĐÁM MÂY", c)
        c = c.replace('<i>Bộ môn Hệ thống Thông tin & Mạng máy tính</i>', f'<b>{NEW_INFO["instructor"]}</b>')
        c = c.replace('<b>DTC245160039</b>', f'<b>{NEW_INFO["name"]} ({NEW_INFO["mssv"]})</b>', 1)
        
        with open(bc_path, 'w', encoding='utf-8', newline='') as f:
            f.write(c)
        update_text_file(bc_path)

        # create a copy named Bao_Cao_Tong_Hop_De02.md
        bc_02_path = os.path.join(ROOT_DIR, 'Bao_Cao_Tong_Hop_De02.md')
        shutil.copyfile(bc_path, bc_02_path)
        print("[OK] Bao_Cao_Tong_Hop_De27.md updated and Bao_Cao_Tong_Hop_De02.md created.")

def update_docx_file():
    old_docx = os.path.join(ROOT_DIR, 'DTC245160004_HoanThien.docx')
    new_docx = os.path.join(ROOT_DIR, f"{NEW_INFO['mssv']}_HoanThien.docx")

    target_source = old_docx if os.path.isfile(old_docx) else new_docx
    if not os.path.isfile(target_source):
        print("[SKIP] No docx file found to update.")
        return

    # Extract, modify xml and re-zip
    temp_dir = os.path.join(ROOT_DIR, 'scripts', '_docx_unpack')
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir, exist_ok=True)

    with zipfile.ZipFile(target_source, 'r') as z:
        z.extractall(temp_dir)

    # 1. Update word/document.xml
    doc_xml_path = os.path.join(temp_dir, 'word', 'document.xml')
    if os.path.isfile(doc_xml_path):
        with open(doc_xml_path, 'r', encoding='utf-8') as f:
            doc_content = f.read()

        doc_content = doc_content.replace('Lê Văn Đức', NEW_INFO['name'])
        doc_content = doc_content.replace('DTC245160004', NEW_INFO['mssv'])
        doc_content = doc_content.replace('DTC245160039', NEW_INFO['mssv'])
        doc_content = doc_content.replace('KHMT K23A', NEW_INFO['class_short'])
        doc_content = doc_content.replace('Đàm Đức Lương', NEW_INFO['name'])
        doc_content = doc_content.replace('HỆ THỐNG QUẢN LÝ NHÂN SỰ\nTÍCH HỢP CHẤM CÔNG BẰNG KHUÔN MẶT', 'HỆ THỐNG QUẢN LÝ SINH VIÊN')
        doc_content = doc_content.replace('HỆ THỐNG QUẢN LÝ NHÂN SỰ TÍCH HỢP CHẤM CÔNG BẰNG KHUÔN MẶT', 'HỆ THỐNG QUẢN LÝ SINH VIÊN')

        with open(doc_xml_path, 'w', encoding='utf-8') as f:
            f.write(doc_content)

    # 2. Update docProps/core.xml
    core_xml_path = os.path.join(temp_dir, 'docProps', 'core.xml')
    if os.path.isfile(core_xml_path):
        with open(core_xml_path, 'r', encoding='utf-8') as f:
            core_content = f.read()
        core_content = re.sub(r'<cp:lastModifiedBy>[^<]*</cp:lastModifiedBy>', '<cp:lastModifiedBy>NgoHoangLan</cp:lastModifiedBy>', core_content)
        core_content = re.sub(r'<dc:creator>[^<]*</dc:creator>', '<dc:creator>NgoHoangLan</dc:creator>', core_content)
        with open(core_xml_path, 'w', encoding='utf-8') as f:
            f.write(core_content)

    # Re-zip to new docx
    with zipfile.ZipFile(new_docx, 'w', zipfile.ZIP_DEFLATED) as z:
        for foldername, subfolders, filenames in os.walk(temp_dir):
            for filename in filenames:
                filepath = os.path.join(foldername, filename)
                arcname = os.path.relpath(filepath, temp_dir)
                z.write(filepath, arcname)

    shutil.rmtree(temp_dir)
    print(f"[OK] Word document updated and saved to: {os.path.basename(new_docx)}")

def update_git_config():
    git_config_path = os.path.join(ROOT_DIR, '.git', 'config')
    if os.path.isfile(git_config_path):
        with open(git_config_path, 'r', encoding='utf-8') as f:
            cfg = f.read()
        
        cfg = re.sub(r'name\s*=\s*.*', f'name = {NEW_INFO["github_user"]}', cfg)
        cfg = re.sub(r'email\s*=\s*.*', f'email = {NEW_INFO["email"]}', cfg)
        cfg = re.sub(r'url\s*=\s*.*', f'url = {NEW_INFO["clone_url"]}', cfg)

        with open(git_config_path, 'w', encoding='utf-8', newline='') as f:
            f.write(cfg)
        print("[OK] .git/config updated with new user, email and remote URL.")

def main():
    print("=== Starting Ownership Migration to Ngô Hoàng Lan (DTC245180012) ===")
    
    files_to_update = [
        os.path.join(ROOT_DIR, 'Huong_Dan_FileZilla_Trien_Khai_Ubuntu.md'),
        os.path.join(ROOT_DIR, 'Huong_Dan_Trien_Khai_Ubuntu_Server.md'),
        os.path.join(ROOT_DIR, 'scripts', 'import_students_excel.py'),
        os.path.join(ROOT_DIR, 'scripts', 'generate_seed_attendance.js'),
        os.path.join(ROOT_DIR, 'scripts', 'gen-certs.sh'),
        os.path.join(ROOT_DIR, 'openssl.cnf'),
        os.path.join(ROOT_DIR, '.env'),
        os.path.join(ROOT_DIR, '.env.example'),
        os.path.join(ROOT_DIR, 'docker-compose.yml'),
        os.path.join(ROOT_DIR, 'docker-compose.monitoring.yml'),
        os.path.join(ROOT_DIR, 'frontend', 'index.html'),
        os.path.join(ROOT_DIR, 'frontend', 'login.html'),
        os.path.join(ROOT_DIR, 'frontend', 'employees.html'),
        os.path.join(ROOT_DIR, 'frontend', 'attendance.html'),
        os.path.join(ROOT_DIR, 'frontend', 'dashboard.html'),
        os.path.join(ROOT_DIR, 'frontend', 'departments.html'),
        os.path.join(ROOT_DIR, 'frontend', 'shifts.html'),
        os.path.join(ROOT_DIR, 'backend', 'package.json'),
        os.path.join(ROOT_DIR, 'backend', 'package-lock.json'),
        os.path.join(ROOT_DIR, 'backend', 'server.js'),
        os.path.join(ROOT_DIR, 'monitoring', 'grafana', 'dashboards', 'hrm-dashboard.json'),
        os.path.join(ROOT_DIR, 'monitoring', 'prometheus', 'prometheus.yml'),
    ]

    for f in files_to_update:
        update_text_file(f)

    update_markdown_headers()
    update_docx_file()
    update_git_config()

    print("=== Migration completed successfully! ===")

if __name__ == '__main__':
    main()
