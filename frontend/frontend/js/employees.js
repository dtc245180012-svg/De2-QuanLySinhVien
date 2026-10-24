// js/employees.js - Quản lý sinh viên & Nhập liệu Excel/CSV
(async () => {
    if (!API.requireAuth()) return;

    try {
        const me = await API.me();
        document.getElementById('meName').textContent = me.data.full_name || me.data.username;
    } catch {}
    document.getElementById('btnLogout').addEventListener('click', () => API.logout());

    const tbody     = document.querySelector('#empTable tbody');
    const deptFilt  = document.getElementById('deptFilter');
    const empDept   = document.getElementById('empDeptSelect');
    const search    = document.getElementById('searchInput');
    const status    = document.getElementById('statusFilter');
    const modal     = document.getElementById('empModal');
    const form      = document.getElementById('empForm');
    const modalTitle= document.getElementById('empModalTitle');
    const errEl     = document.getElementById('empFormError');
    const user      = API.getUser();

    // Form inputs
    const idInput        = document.getElementById('empIdInput');
    const codeInput      = document.getElementById('empCodeInput');
    const nameInput      = document.getElementById('empNameInput');
    const emailInput     = document.getElementById('empEmailInput');
    const phoneInput     = document.getElementById('empPhoneInput');
    const positionInput  = document.getElementById('empPositionInput');
    const hireDateInput  = document.getElementById('empHireDateInput');
    const shiftSelect    = document.getElementById('empShiftSelect');
    const workStartInput = document.getElementById('empWorkStart');
    const workEndInput   = document.getElementById('empWorkEnd');
    const statusGroup    = document.getElementById('empStatusGroup');
    const statusSelect   = document.getElementById('empStatusSelect');
    const leaveDatesGroup= document.getElementById('empLeaveDatesGroup');
    const leaveStartInput= document.getElementById('empLeaveStartInput');
    const leaveEndInput  = document.getElementById('empLeaveEndInput');

    // Leave Modal elements
    const leaveModal     = document.getElementById('leaveModal');
    const leaveForm      = document.getElementById('leaveForm');
    const leaveEmpId     = document.getElementById('leaveEmpId');
    const leaveEmpName   = document.getElementById('leaveEmpName');
    const leaveStartDate = document.getElementById('leaveStartDate');
    const leaveEndDate   = document.getElementById('leaveEndDate');
    const btnCancelLeave = document.getElementById('btnCancelLeave');
    const btnCloseLeave  = document.getElementById('btnCloseLeaveModal');
    const leaveFormError = document.getElementById('leaveFormError');

    // Excel Import elements
    const btnImportExcel      = document.getElementById('btnImportExcel');
    const importExcelModal    = document.getElementById('importExcelModal');
    const btnCloseImportModal = document.getElementById('btnCloseImportModal');
    const btnCancelImport     = document.getElementById('btnCancelImport');
    const excelFileInput      = document.getElementById('excelFileInput');
    const selectedFileName    = document.getElementById('selectedFileName');
    const importPreview       = document.getElementById('importPreview');
    const previewTableBody    = document.querySelector('#previewTable tbody');
    const importProgress      = document.getElementById('importProgress');
    const btnExecuteImport    = document.getElementById('btnExecuteImport');

    let parsedStudents = [];
    let departmentList = [];

    // Shift presets dành cho trường học
    let SHIFT_TIMES = {
        'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)': { start: '07:00', end: '10:30' },
        'Ca chiều (Tiết 7 - 10: 13:00 - 16:30)': { start: '13:00', end: '16:30' },
        'Ca tối (Tiết 11 - 13: 18:00 - 20:30)': { start: '18:00', end: '20:30' },
    };

    async function loadEmpShifts() {
        try {
            const r = await API.get('/shifts');
            if (r.data && r.data.length > 0) {
                SHIFT_TIMES = {};
                shiftSelect.innerHTML = '';
                for (const s of r.data) {
                    SHIFT_TIMES[s.name] = { start: s.work_start, end: s.work_end };
                    shiftSelect.add(new Option(s.name, s.name));
                }
            }
        } catch (e) {
            console.warn('Fallback to default student shifts', e);
        }
    }

    function applyEmpShiftTimes(val) {
        if (SHIFT_TIMES[val]) {
            workStartInput.value = SHIFT_TIMES[val].start;
            workEndInput.value   = SHIFT_TIMES[val].end;
        } else {
            workStartInput.value = '07:00';
            workEndInput.value   = '10:30';
        }
    }

    shiftSelect.addEventListener('change', () => {
        applyEmpShiftTimes(shiftSelect.value);
    });

    if (statusSelect) {
        statusSelect.addEventListener('change', () => {
            if (leaveDatesGroup) {
                leaveDatesGroup.style.display = statusSelect.value === 'on_leave' ? 'block' : 'none';
            }
        });
    }

    function closeModal() {
        modal.classList.remove('open');
        modal.style.setProperty('display', 'none', 'important');
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        if (errEl) errEl.hidden = true;
        form.reset();
    }

    function closeLeaveModal() {
        if (!leaveModal) return;
        leaveModal.classList.remove('open');
        leaveModal.style.setProperty('display', 'none', 'important');
        leaveModal.hidden = true;
        if (leaveFormError) leaveFormError.hidden = true;
        leaveForm.reset();
    }

    function openLeaveModal(emp) {
        leaveForm.reset();
        if (leaveFormError) leaveFormError.hidden = true;
        leaveEmpId.value = emp.id;
        leaveEmpName.textContent = `${emp.full_name} (${emp.employee_code}) - ${emp.department_name || 'Chưa phân lớp'}`;
        const today = new Date().toISOString().slice(0, 10);
        leaveStartDate.value = emp.leave_start ? emp.leave_start.slice(0, 10) : today;
        leaveEndDate.value   = emp.leave_end   ? emp.leave_end.slice(0, 10)   : today;
        leaveStartDate.min = today;
        leaveEndDate.min   = leaveStartDate.value;
        leaveModal.style.setProperty('display', 'flex', 'important');
        leaveModal.hidden = false;
        leaveModal.classList.add('open');
    }

    if (btnCancelLeave) btnCancelLeave.addEventListener('click', (e) => { e.preventDefault(); closeLeaveModal(); });
    if (btnCloseLeave)  btnCloseLeave.addEventListener('click', (e) => { e.preventDefault(); closeLeaveModal(); });
    if (leaveModal)     leaveModal.addEventListener('click', (e) => { if (e.target === leaveModal) closeLeaveModal(); });

    if (leaveStartDate) {
        leaveStartDate.addEventListener('change', () => {
            leaveEndDate.min = leaveStartDate.value;
            if (leaveEndDate.value < leaveStartDate.value) {
                leaveEndDate.value = leaveStartDate.value;
            }
        });
    }

    if (leaveForm) {
        leaveForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const empId = leaveEmpId.value;
            const start = leaveStartDate.value;
            const end   = leaveEndDate.value;
            if (!start || !end) return;
            if (end < start) {
                alert('Ngày kết thúc nghỉ phép không thể trước ngày bắt đầu!');
                return;
            }
            try {
                await API.put('/employees/' + empId, {
                    status: 'on_leave',
                    leave_start: start,
                    leave_end: end
                });
                closeLeaveModal();
                load();
            } catch (err) {
                if (leaveFormError) {
                    leaveFormError.textContent = err.message || 'Lỗi đăng ký nghỉ phép';
                    leaveFormError.hidden = false;
                } else {
                    alert(err.message || 'Lỗi đăng ký nghỉ phép');
                }
            }
        });
    }

    function openModal(isEdit = false, emp = null) {
        form.reset();
        if (errEl) errEl.hidden = true;

        if (isEdit && emp) {
            modalTitle.textContent = `Sửa thông tin: ${emp.full_name} (${emp.employee_code})`;
            idInput.value = emp.id;
            codeInput.value = emp.employee_code;
            codeInput.readOnly = true;
            nameInput.value = emp.full_name || '';
            emailInput.value = emp.email || '';
            phoneInput.value = emp.phone || '';
            empDept.value = emp.department_id || '';
            positionInput.value = emp.position || '';
            hireDateInput.value = emp.hire_date ? emp.hire_date.slice(0, 10) : '';
            let matched = emp.shift_name;
            if (!SHIFT_TIMES[matched]) {
                const sStart = (emp.work_start || '07:00').slice(0, 5);
                const sEnd   = (emp.work_end || '10:30').slice(0, 5);
                matched = Object.keys(SHIFT_TIMES).find(k => 
                    SHIFT_TIMES[k].start === sStart && SHIFT_TIMES[k].end === sEnd
                ) || Object.keys(SHIFT_TIMES)[0];
            }
            shiftSelect.value = matched;
            applyEmpShiftTimes(matched);
            statusSelect.value   = emp.status || 'active';
            statusGroup.style.display = 'block';
            if (leaveDatesGroup) {
                leaveDatesGroup.style.display = emp.status === 'on_leave' ? 'block' : 'none';
                leaveStartInput.value = emp.leave_start ? emp.leave_start.slice(0, 10) : '';
                leaveEndInput.value   = emp.leave_end   ? emp.leave_end.slice(0, 10)   : '';
            }
        } else {
            modalTitle.textContent = 'Thêm sinh viên mới';
            idInput.value = '';
            codeInput.readOnly = false;
            statusGroup.style.display = 'none';
            if (leaveDatesGroup) leaveDatesGroup.style.display = 'none';
            const defaultShiftName = Object.keys(SHIFT_TIMES)[0] || 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)';
            shiftSelect.value = defaultShiftName;
            applyEmpShiftTimes(defaultShiftName);
        }

        modal.style.setProperty('display', 'flex', 'important');
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('open');
    }

    document.getElementById('btnNewEmp').addEventListener('click', () => openModal(false));
    document.getElementById('btnCloseEmpModal').addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
    document.getElementById('btnCancel').addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // ----------------------------------------------------
    // Xử lý Import từ Excel / CSV
    // ----------------------------------------------------
    function openImportModal() {
        if (!importExcelModal) return;
        parsedStudents = [];
        excelFileInput.value = '';
        selectedFileName.textContent = 'Chưa chọn tệp';
        importPreview.style.display = 'none';
        importProgress.style.display = 'none';
        btnExecuteImport.disabled = true;
        previewTableBody.innerHTML = '';
        importExcelModal.style.setProperty('display', 'flex', 'important');
        importExcelModal.hidden = false;
        importExcelModal.classList.add('open');
    }

    function closeImportModal() {
        if (!importExcelModal) return;
        importExcelModal.classList.remove('open');
        importExcelModal.style.setProperty('display', 'none', 'important');
        importExcelModal.hidden = true;
    }

    if (btnImportExcel) btnImportExcel.addEventListener('click', openImportModal);
    if (btnCloseImportModal) btnCloseImportModal.addEventListener('click', closeImportModal);
    if (btnCancelImport) btnCancelImport.addEventListener('click', closeImportModal);
    if (importExcelModal) importExcelModal.addEventListener('click', (e) => { if (e.target === importExcelModal) closeImportModal(); });

    if (excelFileInput) {
        excelFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            selectedFileName.textContent = `📄 Đã chọn: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

            try {
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                if (!rawJson || rawJson.length === 0) {
                    alert('Tệp Excel không chứa dữ liệu dòng nào!');
                    return;
                }

                // Nhận diện cột thông minh (hỗ trợ cả cột Tên tách biệt như file KHMT K23A và cột Họ tên gộp như KTPM K23A)
                parsedStudents = rawJson.map((row, idx) => {
                    const keys = Object.keys(row);
                    const findKey = (keywords) => keys.find(key => {
                        const lk = key.toLowerCase().trim();
                        return keywords.some(kw => lk === kw || lk.includes(kw));
                    });

                    const codeKey = findKey(['mã sinh viên', 'mssv', 'masv', 'mã sv', 'code']) || findKey(['mã']);
                    const code = (codeKey && row[codeKey]) ? String(row[codeKey]).trim() : `SV${String(idx + 1).padStart(3, '0')}`;

                    const nameKey = findKey(['họ và tên', 'họ tên', 'họ đệm', 'họ lót', 'họ']) ||
                                    keys.find(k => k !== codeKey && !k.toLowerCase().includes('mã') && (k.toLowerCase().includes('tên') || k.toLowerCase().includes('name')));
                    let name = (nameKey && row[nameKey]) ? String(row[nameKey]).trim() : '';

                    // Kiểm tra xem có cột Tên riêng kế bên không (ví dụ __EMPTY hoặc Tên riêng)
                    const firstNameKey = keys.find(k => k === '__EMPTY' || (/^(tên|ten)$/i.test(k.trim())));
                    if (firstNameKey && row[firstNameKey] && String(row[firstNameKey]).trim()) {
                        const fnVal = String(row[firstNameKey]).trim();
                        if (!name.endsWith(fnVal)) {
                            name = (name + ' ' + fnVal).trim();
                        }
                    }
                    if (!name) name = `Sinh viên ${idx + 1}`;

                    const deptKey = findKey(['lớp', 'khoa/viện', 'khoa', 'phòng', 'class', 'dept']);
                    const dept = (deptKey && row[deptKey]) ? String(row[deptKey]).trim() : 'Lớp Công nghệ Thông tin K24A (CNTT K24A)';

                    const emailKey = findKey(['email', 'mail']);
                    const email = (emailKey && row[emailKey]) ? String(row[emailKey]).trim() : `${code.toLowerCase()}@ictu.edu.vn`;

                    const phoneKey = findKey(['phone', 'điện thoại', 'sđt', 'tel']);
                    const phone = (phoneKey && row[phoneKey]) ? String(row[phoneKey]).trim() : '';

                    const roleKey = findKey(['chức', 'vụ', 'vai trò', 'position']);
                    const role = (roleKey && row[roleKey]) ? String(row[roleKey]).trim() : 'Sinh viên';

                    return { employee_code: code, full_name: name, department_name: dept, email, phone, position: role };
                }).filter(s => s.employee_code && s.full_name);

                // Hiển thị preview 5 dòng đầu
                previewTableBody.innerHTML = '';
                const previewRows = parsedStudents.slice(0, 5);
                for (const s of previewRows) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td><strong>${API.escapeHtml(s.employee_code)}</strong></td><td>${API.escapeHtml(s.full_name)}</td><td>${API.escapeHtml(s.department_name)}</td><td>${API.escapeHtml(s.email)}</td>`;
                    previewTableBody.appendChild(tr);
                }
                importPreview.style.display = 'block';
                btnExecuteImport.disabled = false;
                btnExecuteImport.textContent = `Bắt đầu nhập (${parsedStudents.length} sinh viên)`;
            } catch (err) {
                console.error('Lỗi đọc tệp Excel', err);
                alert('Không thể đọc tệp Excel: ' + err.message);
            }
        });
    }

    if (btnExecuteImport) {
        btnExecuteImport.addEventListener('click', async () => {
            if (!parsedStudents || parsedStudents.length === 0) return;
            btnExecuteImport.disabled = true;
            importProgress.style.display = 'block';

            let count = 0;
            let errors = 0;

            for (const s of parsedStudents) {
                try {
                    // Tìm id lớp học phù hợp
                    let deptId = null;
                    const matchedDept = departmentList.find(d => 
                        d.name.toLowerCase().includes(s.department_name.toLowerCase()) ||
                        s.department_name.toLowerCase().includes(d.name.toLowerCase())
                    );
                    if (matchedDept) {
                        deptId = matchedDept.id;
                    } else if (departmentList.length > 0) {
                        deptId = departmentList[0].id;
                    }

                    const fd = new FormData();
                    fd.append('employee_code', s.employee_code);
                    fd.append('full_name', s.full_name);
                    fd.append('email', s.email);
                    fd.append('phone', s.phone);
                    if (deptId) fd.append('department_id', deptId);
                    fd.append('position', s.position || 'Sinh viên');
                    fd.append('work_start', '07:00');
                    fd.append('work_end', '10:30');
                    fd.append('shift_name', 'Ca sáng (Tiết 1 - 4: 07:00 - 10:30)');

                    await API.post('/employees', fd);
                    count++;
                } catch (err) {
                    errors++;
                }
            }

            importProgress.style.display = 'none';
            alert(`Nhập thành công ${count} sinh viên vào hệ thống!` + (errors > 0 ? ` (${errors} sinh viên đã tồn tại hoặc bỏ qua)` : ''));
            closeImportModal();
            load();
        });
    }

    async function loadDepts() {
        try {
            const r = await API.get('/departments');
            departmentList = r.data || [];
            deptFilt.innerHTML = '<option value="">-- Tất cả Lớp học / Khoa --</option>';
            empDept.innerHTML  = '<option value="">-- Chọn Lớp học / Khoa --</option>';
            for (const d of departmentList) {
                deptFilt.add(new Option(d.name, d.id));
                empDept.add(new Option(d.name, d.id));
            }
        } catch (e) {
            console.error('Failed to load classes', e);
        }
    }

    async function load() {
        try {
            const params = new URLSearchParams();
            params.set('limit', '500');
            if (search.value.trim()) params.set('search', search.value.trim());
            if (deptFilt.value)      params.set('department_id', deptFilt.value);
            if (status.value)        params.set('status', status.value);

            const r = await API.get('/employees?' + params.toString());
            const employees = r.data || [];
            employees.sort((a, b) => {
                const nameA = (a.full_name || '').trim();
                const nameB = (b.full_name || '').trim();
                const partsA = nameA.split(/\s+/);
                const partsB = nameB.split(/\s+/);
                const firstNameA = partsA[partsA.length - 1] || '';
                const firstNameB = partsB[partsB.length - 1] || '';
                const cmp = firstNameA.localeCompare(firstNameB, 'vi', { sensitivity: 'base' });
                if (cmp !== 0) return cmp;
                const cmpFull = nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
                if (cmpFull !== 0) return cmpFull;
                return (a.employee_code || '').localeCompare(b.employee_code || '');
            });

            tbody.innerHTML = '';
            for (const e of employees) {
                const tr = document.createElement('tr');
                const shiftLabel = `<span class="badge badge-shift">${API.escapeHtml(e.shift_name || 'Ca sáng (Tiết 1 - 4)')}</span>`;
                
                let statusBadge = '';
                if (e.status === 'active') {
                    statusBadge = '<span class="badge badge-active">Đang học</span>';
                } else if (e.status === 'on_leave') {
                    const lFrom = e.leave_start ? e.leave_start.slice(0, 10).split('-').reverse().join('/') : '';
                    const lTo   = e.leave_end   ? e.leave_end.slice(0, 10).split('-').reverse().join('/')   : '';
                    const leaveHint = (lFrom && lTo) ? ` (${lFrom} - ${lTo})` : '';
                    statusBadge = `<span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;" title="Nghỉ phép${leaveHint}">Nghỉ phép</span>`;
                } else {
                    statusBadge = '<span class="badge badge-terminated">Đã thôi học</span>';
                }

                const faceBadge = e.has_face
                    ? '<span class="badge badge-on-time">Đã có</span>'
                    : '<span class="badge badge-terminated">Chưa có</span>';

                tr.innerHTML = `
                    <td><strong>${API.escapeHtml(e.employee_code)}</strong></td>
                    <td><strong>${API.escapeHtml(e.full_name)}</strong></td>
                    <td>${API.escapeHtml(e.department_name || '-')}</td>
                    <td><span class="badge" style="background:#e0f2fe;color:#0369a1;">${API.escapeHtml(e.position || 'Sinh viên')}</span></td>
                    <td>${shiftLabel}</td>
                    <td>${statusBadge}</td>
                    <td>${faceBadge}</td>
                    <td></td>`;

                const actions = tr.lastElementChild;
                actions.className = 'actions-cell';

                if (user && (user.role === 'admin' || user.role === 'hr')) {
                    // Nút Sửa
                    const btnEdit = document.createElement('button');
                    btnEdit.className = 'btn btn-sm btn-secondary';
                    btnEdit.textContent = 'Sửa';
                    btnEdit.onclick = () => openModal(true, e);
                    actions.appendChild(btnEdit);

                    // Nút Nghỉ phép / Đi học lại
                    if (e.status === 'active') {
                        const btnLeave = document.createElement('button');
                        btnLeave.className = 'btn btn-sm';
                        btnLeave.style.background = '#fef3c7';
                        btnLeave.style.color = '#92400e';
                        btnLeave.style.borderColor = '#fde68a';
                        btnLeave.textContent = 'Nghỉ phép';
                        btnLeave.title = 'Đăng ký thời gian nghỉ phép';
                        btnLeave.onclick = () => openLeaveModal(e);
                        actions.appendChild(btnLeave);
                    } else if (e.status === 'on_leave') {
                        const btnBack = document.createElement('button');
                        btnBack.className = 'btn btn-sm btn-primary';
                        btnBack.textContent = 'Đi học lại';
                        btnBack.title = 'Kích hoạt sinh viên đi học lại sớm hơn dự kiến';
                        btnBack.onclick = async () => {
                            if (!confirm(`Xác nhận cho sinh viên ${e.full_name} (${e.employee_code}) đi học lại ngay hôm nay?`)) return;
                            try {
                                await API.put('/employees/' + e.id, {
                                    ...e,
                                    status: 'active',
                                    leave_start: null,
                                    leave_end: null
                                });
                                load();
                            } catch (err) {
                                alert(err.message || 'Thao tác thất bại');
                            }
                        };
                        actions.appendChild(btnBack);
                    }

                    // Nút Xoá
                    if (user.role === 'admin') {
                        const btnDel = document.createElement('button');
                        btnDel.className = 'btn btn-sm';
                        btnDel.style.borderColor = '#ef4444';
                        btnDel.style.color = '#ef4444';
                        btnDel.textContent = 'Xoá';
                        btnDel.onclick = async () => {
                            if (!confirm(`Bạn có chắc muốn xoá hồ sơ sinh viên ${e.full_name} (${e.employee_code})?`)) return;
                            try {
                                await API.del('/employees/' + e.id + '?hard=true');
                                load();
                            } catch (err) {
                                alert(err.message || 'Xoá thất bại');
                            }
                        };
                        actions.appendChild(btnDel);
                    }
                }
                tbody.appendChild(tr);
            }
            if (r.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center;padding:16px;">Không tìm thấy sinh viên nào.</td></tr>';
            }
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="8" class="error" style="text-align:center;padding:16px;">Không thể tải danh sách sinh viên: ${err.message}</td></tr>`;
        }
    }

    document.getElementById('btnReload').addEventListener('click', load);
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
    deptFilt.addEventListener('change', load);
    status.addEventListener('change', load);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const id = idInput.value;
        errEl.hidden = true;
        try {
            if (id) {
                await API.put('/employees/' + id, fd);
            } else {
                await API.post('/employees', fd);
            }
            closeModal();
            load();
        } catch (err) {
            errEl.textContent = err.message || 'Có lỗi xảy ra khi lưu hồ sơ sinh viên';
            errEl.hidden = false;
        }
    });

    closeModal();
    await loadDepts();
    await loadEmpShifts();
    await load();
})();
