// js/attendance.js - face-based attendance
(async () => {
    if (!API.requireAuth()) return;
    try {
        const me = await API.me();
        document.getElementById('meName').textContent = me.data.full_name || me.data.username;
    } catch {}
    document.getElementById('btnLogout').addEventListener('click', () => API.logout());

    const currentUser = API.getUser();
    if (currentUser && currentUser.role === 'kiosk') {
        const nav = document.querySelector('.topbar nav');
        if (nav) {
            nav.innerHTML = '<span style="color:#93c5fd;font-weight:600;display:flex;align-items:center;gap:6px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> Kiosk Điểm danh Sinh viên (Cửa phòng học)</span>';
        }
        const brandSm = document.querySelector('.topbar .brand-sm');
        if (brandSm) brandSm.textContent = 'KIOSK ĐIỂM DANH SINH VIÊN';
        const pageH1 = document.querySelector('main h1');
        if (pageH1) {
            pageH1.innerHTML = 'Máy điểm danh sinh viên bằng khuôn mặt <span style="font-size:0.55em;color:#0284c7;font-weight:600;padding:4px 10px;background:#e0f2fe;border-radius:12px;margin-left:8px;vertical-align:middle;display:inline-block;">Kiosk Cửa phòng học</span>';
        }
    }

    const video      = document.getElementById('video');
    const btnStart   = document.getElementById('btnStartCam');
    const btnStop    = document.getElementById('btnStopCam');
    const btnCapture = document.getElementById('btnCapture');
    const fileInput  = document.getElementById('fileInput');
    const resultBox  = document.getElementById('resultBox');
    const myAttBody  = document.querySelector('#myAttTable tbody');
    let stream = null;

    function showResult(kind, html) {
        resultBox.className = 'result-' + kind;
        resultBox.innerHTML = html;
    }

    const statusMap = {
        on_time: '<span class="badge badge-on-time">Đến đúng giờ</span>',
        late: '<span class="badge badge-late">Đi muộn</span>',
        early_leave: '<span class="badge badge-early-leave">Về sớm</span>',
        absent: '<span class="badge badge-absent">Vắng mặt</span>'
    };

    async function submitImage(blob, filename = 'capture.jpg') {
        const fd = new FormData();
        fd.append('file', blob, filename);
        resultBox.className = 'result-empty';
        resultBox.textContent = 'Đang xử lý nhận diện khuôn mặt sinh viên...';
        btnCapture.disabled = true;
        try {
            const r = await API.post('/attendance/face-check', fd);
            const d = r.data;
            if (d.matched === false) {
                showResult('warn',
                    `<h3>Không nhận diện được</h3>
                     <p>Không có sinh viên nào trong hệ thống khớp với khuôn mặt này.</p>
                     <p class="result-meta">Độ sai lệch: ${d.distance} (ngưỡng: ${d.threshold})</p>`);
                return;
            }
            const stBadge = (d.attendance && statusMap[d.attendance.status]) || `<span class="badge">${(d.attendance && d.attendance.status) || ''}</span>`;
            if (d.action === 'check_in') {
                showResult('ok',
                    `<h3>Điểm danh vào thành công</h3>
                     <p><b>${d.employee.full_name}</b> (MSSV: ${d.employee.employee_code})</p>
                     <p>Trạng thái: ${stBadge}</p>
                     <p class="result-meta">Độ tin cậy: ${(d.confidence * 100).toFixed(1)}%</p>`);
            } else if (d.action === 'check_out') {
                showResult('ok',
                    `<h3>Điểm danh ra thành công</h3>
                     <p><b>${d.employee.full_name}</b> (MSSV: ${d.employee.employee_code})</p>
                     <p>Trạng thái: ${stBadge}</p>
                     <p class="result-meta">Độ tin cậy: ${(d.confidence * 100).toFixed(1)}%</p>`);
            } else {
                let msg = d.message || 'Đã hoàn thành điểm danh vào và ra cho buổi học hôm nay.';
                if (msg.toLowerCase().includes('already checked')) {
                    msg = 'Sinh viên đã hoàn thành điểm danh vào và ra cho buổi học hôm nay.';
                }
                showResult('warn', `<h3>Thông báo</h3><p>${msg}</p>`);
            }
            loadMyHistory();
        } catch (err) {
            let errMsg = (err.data && (err.data.message || err.data.error)) || err.message || 'Không rõ lỗi';
            if (err.data && (err.data.error === 'NO_FACE' || err.data.message === 'No face detected in image')) {
                errMsg = 'Không tìm thấy khuôn mặt trong ảnh. Vui lòng đưa khuôn mặt vào giữa khung hình rõ ràng.';
            } else if (err.data && err.data.error === 'NO_ENROLLED_EMPLOYEE') {
                errMsg = 'Chưa có sinh viên nào đăng ký khuôn mặt trong hệ thống.';
            } else if (err.data && (err.data.error === 'AI service unavailable' || err.data.error === 'Dịch vụ AI nhận diện không khả dụng')) {
                errMsg = 'Dịch vụ AI nhận diện khuôn mặt hiện chưa sẵn sàng.';
            }
            showResult('err', `<h3>Lỗi điểm danh</h3><p>${errMsg}</p>`);
        } finally {
            if (stream) btnCapture.disabled = false;
        }
    }

    btnStart.addEventListener('click', async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            video.srcObject = stream;
            btnCapture.disabled = false;
            btnStart.disabled = true;
            btnStop.disabled = false;
            stream.getTracks().forEach(t => {
                t.onended = () => {
                    if (stream) btnStop.click();
                };
            });
        } catch (err) {
            alert('Không mở được camera: ' + err.message);
        }
    });

    btnStop.addEventListener('click', () => {
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
            video.srcObject = null;
        }
        btnCapture.disabled = true;
        btnStart.disabled = false;
        btnStop.disabled = true;
    });

    btnCapture.addEventListener('click', () => {
        if (!stream) return;
        const canvas = document.createElement('canvas');
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => submitImage(blob, 'capture.jpg'), 'image/jpeg', 0.85);
    });

    fileInput.addEventListener('change', () => {
        const f = fileInput.files[0];
        if (f) submitImage(f, f.name);
    });

    async function loadMyHistory() {
        const user = API.getUser();
        const canViewCompanyHistory = user && (user.role === 'admin' || user.role === 'hr' || user.role === 'kiosk');
        const titleEl = document.getElementById('attHistoryTitle');
        if (titleEl) {
            titleEl.textContent = 'Lịch sử điểm danh sinh viên gần đây';
        }

        try {
            // For admin/hr/kiosk, fetch the latest 30 company records; for employee, fetch their personal records
            const endpoint = canViewCompanyHistory ? '/attendance?limit=30' : '/attendance/me';
            const r = await API.get(endpoint);
            myAttBody.innerHTML = '';
            const rows = r.data || [];

            if (rows.length === 0) {
                myAttBody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:16px;">Chưa có dữ liệu điểm danh.</td></tr>';
                return;
            }

            for (const row of rows) {
                const tr = document.createElement('tr');
                const dateStr = row.date ? (row.date.slice ? row.date.slice(0, 10) : new Date(row.date).toLocaleDateString('vi-VN')) : '-';
                const ci = row.check_in  ? new Date(row.check_in).toLocaleTimeString('vi-VN')  : '-';
                const co = row.check_out ? new Date(row.check_out).toLocaleTimeString('vi-VN') : '-';
                const conf = row.confidence_in || row.confidence_out || null;
                const empInfo = row.full_name
                    ? `<strong>${API.escapeHtml(row.employee_code)}</strong> - ${API.escapeHtml(row.full_name)}`
                    : (row.employee_code ? `<strong>${API.escapeHtml(row.employee_code)}</strong>` : 'Tôi');

                let badgesHtml = '';
                const inStatus = row.check_in_status || (row.status === 'late' ? 'late' : (row.status === 'absent' ? 'absent' : 'on_time'));
                const outStatus = row.check_out_status || (row.status === 'early_leave' ? 'early_leave' : (row.check_out ? 'on_time' : null));

                if (row.status === 'absent') {
                    badgesHtml = '<span class="badge badge-absent">Vắng mặt</span>';
                } else if (inStatus === 'on_time' && outStatus === 'early_leave') {
                    badgesHtml = '<span class="badge badge-on-time">Đến đúng giờ</span> <span class="badge badge-early-leave">Về sớm</span>';
                } else if (inStatus === 'late' && outStatus === 'early_leave') {
                    badgesHtml = '<span class="badge badge-late">Đi muộn</span> <span class="badge badge-early-leave">Về sớm</span>';
                } else if (inStatus === 'late') {
                    badgesHtml = '<span class="badge badge-late">Đi muộn</span>';
                } else if (inStatus === 'on_time') {
                    badgesHtml = '<span class="badge badge-on-time">Đúng giờ</span>';
                } else {
                    badgesHtml = `<span class="badge">${row.status}</span>`;
                }

                tr.innerHTML = `
                    <td>${dateStr}</td>
                    <td>${empInfo}</td>
                    <td>${ci}</td>
                    <td>${co}</td>
                    <td>${badgesHtml}</td>
                    <td>${conf ? (parseFloat(conf) * 100).toFixed(1) + '%' : (row.check_in_method === 'manual' ? '<span class="badge" style="background:#e0e7ff;color:#3730a3;">Thủ công</span>' : '-')}</td>
                `;
                myAttBody.appendChild(tr);
            }
        } catch (err) {
            myAttBody.innerHTML = `<tr><td colspan="6" class="error" style="text-align:center;padding:16px;">Lỗi tải lịch sử điểm danh: ${err.message}</td></tr>`;
        }
    }

    const btnReloadAtt = document.getElementById('btnReloadAtt');
    if (btnReloadAtt) btnReloadAtt.addEventListener('click', loadMyHistory);

    // --- DIEM DANH THU CONG (Admin / Giao vien) ---
    const btnManualModal   = document.getElementById('btnManualCheckModal');
    const manualModal      = document.getElementById('manualCheckModal');
    const btnCloseManual   = document.getElementById('btnCloseManualModal');
    const btnCancelManual  = document.getElementById('btnCancelManual');
    const manualForm       = document.getElementById('manualCheckForm');
    const manualDeptSelect = document.getElementById('manualDeptSelect');
    const manualEmpSelect  = document.getElementById('manualEmpSelect');
    const manualCheckError = document.getElementById('manualCheckError');

    let allStudentsCache = [];

    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'hr')) {
        if (btnManualModal) btnManualModal.style.display = 'inline-flex';

        async function loadManualData() {
            try {
                const dRes = await API.get('/departments');
                const depts = dRes.data || [];
                manualDeptSelect.innerHTML = '<option value="">-- Tất cả các lớp --</option>' +
                    depts.map(d => `<option value="${d.id}">${API.escapeHtml(d.name)}</option>`).join('');

                const eRes = await API.get('/employees?limit=300');
                allStudentsCache = eRes.data || [];
                renderStudentOptions();
            } catch (err) {
                console.error('Lỗi nạp danh sách điểm danh:', err);
            }
        }

        function renderStudentOptions() {
            const selectedDept = manualDeptSelect.value;
            const filtered = selectedDept
                ? allStudentsCache.filter(s => String(s.department_id) === String(selectedDept))
                : allStudentsCache;

            if (filtered.length === 0) {
                manualEmpSelect.innerHTML = '<option value="">-- Không có sinh viên nào --</option>';
                return;
            }

            manualEmpSelect.innerHTML = '<option value="">-- Chọn sinh viên --</option>' +
                filtered.map(s => `<option value="${s.id}">[${API.escapeHtml(s.employee_code)}] ${API.escapeHtml(s.full_name)} (${API.escapeHtml(s.department_name || '')})</option>`).join('');
        }

        manualDeptSelect.addEventListener('change', renderStudentOptions);

        btnManualModal.addEventListener('click', async () => {
            manualCheckError.hidden = true;
            manualModal.hidden = false;
            if (allStudentsCache.length === 0) {
                await loadManualData();
            }
        });

        const closeManualModal = () => { manualModal.hidden = true; manualForm.reset(); };
        if (btnCloseManual) btnCloseManual.addEventListener('click', closeManualModal);
        if (btnCancelManual) btnCancelManual.addEventListener('click', closeManualModal);

        manualForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            manualCheckError.hidden = true;
            const empId = manualEmpSelect.value;
            const type = document.getElementById('manualTypeSelect').value;
            const note = document.getElementById('manualNoteInput').value.trim();

            if (!empId) {
                manualCheckError.textContent = 'Vui lòng chọn một sinh viên!';
                manualCheckError.hidden = false;
                return;
            }

            const btnSubmit = document.getElementById('btnSubmitManual');
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Đang xử lý...';

            try {
                await API.post('/attendance/manual', {
                    employee_id: parseInt(empId, 10),
                    type,
                    note
                });

                closeManualModal();
                alert('Đã điểm danh thủ công thành công!');
                await loadMyHistory();
            } catch (err) {
                manualCheckError.textContent = err.data?.error || err.message || 'Lỗi khi điểm danh thủ công';
                manualCheckError.hidden = false;
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Xác nhận Điểm danh';
            }
        });
    }

    await loadMyHistory();
})();
