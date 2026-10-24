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

    // --- SO DIEM DANH THEO LOP (Admin / Giao vien) ---
    const btnManualModal    = document.getElementById('btnManualCheckModal');
    const manualModal       = document.getElementById('manualCheckModal');
    const btnCloseManual    = document.getElementById('btnCloseManualModal');
    const btnCancelManual   = document.getElementById('btnCancelManual');
    const manualDeptSelect  = document.getElementById('manualDeptSelect');
    const manualSearchInput = document.getElementById('manualSearchStudent');
    const studentListTbody  = document.getElementById('rollCallStudentList');
    const statTotalEl       = document.getElementById('statTotal');
    const statPresentEl     = document.getElementById('statPresent');
    const statAbsentEl      = document.getElementById('statAbsent');
    const btnMarkAllPresent = document.getElementById('btnMarkAllPresent');
    const btnMarkAllAbsent  = document.getElementById('btnMarkAllAbsent');
    const btnSubmitRollCall = document.getElementById('btnSubmitRollCall');
    const manualCheckError  = document.getElementById('manualCheckError');
    const manualProgress    = document.getElementById('manualCheckProgress');
    const progressText      = document.getElementById('progressText');

    let allStudentsCache = [];
    let currentClassStudents = [];
    let studentStatusMap = {}; // empId -> { status: 'present'|'absent', note: '' }

    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'hr')) {
        if (btnManualModal) btnManualModal.style.display = 'inline-flex';

        async function loadRollCallClasses() {
            try {
                manualDeptSelect.innerHTML = '<option value="">-- Đang nạp danh sách lớp... --</option>';
                const [dRes, eRes] = await Promise.all([
                    API.get('/departments'),
                    API.get('/employees?limit=500')
                ]);
                const depts = dRes.data || [];
                allStudentsCache = eRes.data || [];

                manualDeptSelect.innerHTML = '<option value="">-- Chọn lớp cần điểm danh --</option>' +
                    depts.map(d => {
                        const count = allStudentsCache.filter(s => String(s.department_id) === String(d.id)).length;
                        return `<option value="${d.id}">${API.escapeHtml(d.name)} (${count} sinh viên)</option>`;
                    }).join('');

                if (depts.length > 0) {
                    manualDeptSelect.value = depts[0].id;
                    renderClassRollCall();
                }
            } catch (err) {
                console.error('Lỗi nạp danh sách lớp:', err);
                manualDeptSelect.innerHTML = '<option value="">-- Lỗi tải danh sách lớp --</option>';
            }
        }

        function updateStats() {
            let present = 0;
            let absent = 0;
            currentClassStudents.forEach(s => {
                const state = studentStatusMap[s.id] || { status: 'present' };
                if (state.status === 'present') present++;
                else absent++;
            });
            statTotalEl.textContent = currentClassStudents.length;
            statPresentEl.textContent = present;
            statAbsentEl.textContent = absent;
        }

        function renderClassRollCall() {
            const selectedDept = manualDeptSelect.value;
            if (!selectedDept) {
                currentClassStudents = [];
                studentListTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 36px;">Vui lòng chọn một lớp học ở trên để hiển thị danh sách sinh viên.</td></tr>';
                updateStats();
                return;
            }

            currentClassStudents = allStudentsCache.filter(s => String(s.department_id) === String(selectedDept));

            // Sắp xếp danh sách sinh viên theo thứ tự Alphabet (A-Z) theo Tên tiếng Việt
            currentClassStudents.sort((a, b) => {
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

            currentClassStudents.forEach(s => {
                if (!studentStatusMap[s.id]) {
                    studentStatusMap[s.id] = { status: 'present', note: '' };
                }
            });

            applyFilterAndRender();
        }

        function applyFilterAndRender() {
            const query = (manualSearchInput.value || '').trim().toLowerCase();
            const filtered = query
                ? currentClassStudents.filter(s => 
                    (s.full_name && s.full_name.toLowerCase().includes(query)) ||
                    (s.employee_code && s.employee_code.toLowerCase().includes(query))
                  )
                : currentClassStudents;

            updateStats();

            if (filtered.length === 0) {
                studentListTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 30px;">Không tìm thấy sinh viên nào khớp với tìm kiếm.</td></tr>';
                return;
            }

            studentListTbody.innerHTML = filtered.map((s, idx) => {
                const cur = studentStatusMap[s.id] || { status: 'present', note: '' };
                const isPresent = cur.status === 'present';
                return `
                    <tr data-emp-id="${s.id}">
                        <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                        <td style="font-weight: 700; color: #1e293b;">${API.escapeHtml(s.employee_code)}</td>
                        <td style="font-weight: 600; color: #0f172a;">${API.escapeHtml(s.full_name)}</td>
                        <td style="text-align: center;">
                            <div style="display: inline-flex; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                <label style="cursor: pointer; padding: 5px 12px; font-weight: 600; font-size: 0.86em; margin: 0; background: ${isPresent ? '#dcfce7' : '#f8fafc'}; color: ${isPresent ? '#15803d' : '#64748b'}; transition: all 0.15s;" class="lbl-present">
                                    <input type="radio" name="att_status_${s.id}" value="present" ${isPresent ? 'checked' : ''} style="margin-right: 4px; accent-color: #16a34a;"> Có mặt
                                </label>
                                <label style="cursor: pointer; padding: 5px 12px; font-weight: 600; font-size: 0.86em; margin: 0; background: ${!isPresent ? '#fee2e2' : '#f8fafc'}; color: ${!isPresent ? '#b91c1c' : '#64748b'}; border-left: 1px solid #cbd5e1; transition: all 0.15s;" class="lbl-absent">
                                    <input type="radio" name="att_status_${s.id}" value="absent" ${!isPresent ? 'checked' : ''} style="margin-right: 4px; accent-color: #dc2626;"> Vắng
                                </label>
                            </div>
                        </td>
                        <td>
                            <input type="text" class="student-note" data-emp-id="${s.id}" value="${API.escapeHtml(cur.note || '')}" placeholder="Ghi chú..." style="padding: 5px 10px; font-size: 0.88em; width: 100%; border: 1px solid #e2e8f0; border-radius: 4px;">
                        </td>
                    </tr>
                `;
            }).join('');
        }

        studentListTbody.addEventListener('change', (e) => {
            if (e.target && e.target.type === 'radio') {
                const tr = e.target.closest('tr');
                if (!tr) return;
                const empId = tr.dataset.empId;
                if (!empId) return;

                const val = e.target.value;
                if (!studentStatusMap[empId]) studentStatusMap[empId] = { status: 'present', note: '' };
                studentStatusMap[empId].status = val;

                const lblPresent = tr.querySelector('.lbl-present');
                const lblAbsent  = tr.querySelector('.lbl-absent');
                if (val === 'present') {
                    if (lblPresent) { lblPresent.style.background = '#dcfce7'; lblPresent.style.color = '#15803d'; }
                    if (lblAbsent)  { lblAbsent.style.background = '#f8fafc';  lblAbsent.style.color = '#64748b'; }
                } else {
                    if (lblPresent) { lblPresent.style.background = '#f8fafc'; lblPresent.style.color = '#64748b'; }
                    if (lblAbsent)  { lblAbsent.style.background = '#fee2e2';  lblAbsent.style.color = '#b91c1c'; }
                }

                updateStats();
            }
        });

        studentListTbody.addEventListener('input', (e) => {
            if (e.target && e.target.classList.contains('student-note')) {
                const empId = e.target.dataset.empId;
                if (empId) {
                    if (!studentStatusMap[empId]) studentStatusMap[empId] = { status: 'present', note: '' };
                    studentStatusMap[empId].note = e.target.value.trim();
                }
            }
        });

        manualDeptSelect.addEventListener('change', () => {
            manualSearchInput.value = '';
            renderClassRollCall();
        });

        manualSearchInput.addEventListener('input', applyFilterAndRender);

        btnMarkAllPresent.addEventListener('click', () => {
            currentClassStudents.forEach(s => {
                if (!studentStatusMap[s.id]) studentStatusMap[s.id] = { status: 'present', note: '' };
                studentStatusMap[s.id].status = 'present';
            });
            applyFilterAndRender();
        });

        btnMarkAllAbsent.addEventListener('click', () => {
            currentClassStudents.forEach(s => {
                if (!studentStatusMap[s.id]) studentStatusMap[s.id] = { status: 'absent', note: '' };
                studentStatusMap[s.id].status = 'absent';
            });
            applyFilterAndRender();
        });

        const openRollCallModal = async () => {
            manualCheckError.hidden = true;
            manualProgress.style.display = 'none';
            manualModal.classList.add('open');
            manualModal.style.display = 'flex';
            if (allStudentsCache.length === 0) {
                await loadRollCallClasses();
            }
        };

        btnManualModal.addEventListener('click', openRollCallModal);

        if (new URLSearchParams(location.search).get('open') === 'rollcall') {
            setTimeout(openRollCallModal, 200);
        }

        const closeManualModal = () => { 
            manualModal.classList.remove('open'); 
            manualModal.style.display = 'none';
        };
        if (btnCloseManual) btnCloseManual.addEventListener('click', closeManualModal);
        if (btnCancelManual) btnCancelManual.addEventListener('click', closeManualModal);
        manualModal.addEventListener('click', (e) => {
            if (e.target === manualModal) closeManualModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && manualModal.classList.contains('open')) closeManualModal();
        });

        btnSubmitRollCall.addEventListener('click', async () => {
            if (!currentClassStudents || currentClassStudents.length === 0) {
                alert('Vui lòng chọn một lớp học có sinh viên trước khi lưu!');
                return;
            }

            manualCheckError.hidden = true;
            btnSubmitRollCall.disabled = true;
            btnSubmitRollCall.textContent = 'Đang lưu điểm danh...';
            manualProgress.style.display = 'block';

            const items = currentClassStudents.map(s => {
                const state = studentStatusMap[s.id] || { status: 'present', note: '' };
                return {
                    employee_id: s.id,
                    status: state.status,
                    note: state.note || (state.status === 'present' ? 'Điểm danh theo lớp' : 'Vắng mặt theo lớp')
                };
            });

            progressText.textContent = `0 / ${items.length}`;

            try {
                let batchSuccess = false;
                try {
                    const res = await API.post('/attendance/manual-batch', { items });
                    if (res && res.ok) {
                        batchSuccess = true;
                    }
                } catch (batchErr) {
                    console.warn('Batch endpoint fallback', batchErr);
                }

                if (!batchSuccess) {
                    let completed = 0;
                    const promises = items.map(async (item) => {
                        try {
                            if (item.status === 'present') {
                                await API.post('/attendance/manual', {
                                    employee_id: item.employee_id,
                                    type: 'in',
                                    note: item.note
                                });
                            } else {
                                await API.post('/attendance/manual', {
                                    employee_id: item.employee_id,
                                    type: 'absent',
                                    note: item.note
                                });
                            }
                        } catch (err) {
                            console.log('Item attend result:', err.message);
                        } finally {
                            completed++;
                            progressText.textContent = `${completed} / ${items.length}`;
                        }
                    });
                    await Promise.allSettled(promises);
                }

                progressText.textContent = `${items.length} / ${items.length} - Hoàn tất!`;
                alert(`Đã lưu bảng điểm danh thành công cho ${items.length} sinh viên!`);
                closeManualModal();
                await loadMyHistory();
            } catch (err) {
                manualCheckError.textContent = 'Lỗi lưu điểm danh: ' + (err.message || 'Không rõ lỗi');
                manualCheckError.hidden = false;
            } finally {
                btnSubmitRollCall.disabled = false;
                btnSubmitRollCall.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Lưu bảng điểm danh lớp`;
                manualProgress.style.display = 'none';
            }
        });
    }

    await loadMyHistory();
})();
