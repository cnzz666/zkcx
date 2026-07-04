// ================================================================
//  成绩记录系统 — Cloudflare Pages + D1 (自动建表)
//  绑定变量名: DB  |  后台密码: admin
//  完全开箱即用，部署即运行
// ================================================================

export default {
  async fetch(request, env) {
    // 首次访问自动创建表
    await ensureTable(env);

    const url = new URL(request.url);
    const path = url.pathname;

    // API 路由
    if (path === '/api/records') {
      const method = request.method;
      if (method === 'GET') return handleGet(env);
      if (method === 'POST') return handlePost(request, env);
      if (method === 'DELETE') return handleDelete(request, env);
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
    }

    // 页面路由
    if (path === '/' || path === '/admin') {
      return new Response(getHtml(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};

// ---------- 建表 ----------
async function ensureTable(env) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        score TEXT NOT NULL,
        rank TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ).run();
  } catch (_) { /* 忽略 */ }
}

// ---------- GET ----------
async function handleGet(env) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, name, score, rank, created_at FROM records ORDER BY created_at ASC'
    ).all();
    return Response.json(results);
  } catch (err) {
    return errorResponse(err.message);
  }
}

// ---------- POST ----------
async function handlePost(request, env) {
  try {
    const body = await request.json();
    const { name, score, rank, reupload } = body;
    if (!name?.trim() || !score?.trim()) {
      return errorResponse('姓名和分数不能为空', 400);
    }

    const existing = await env.DB.prepare('SELECT id FROM records WHERE name = ?')
      .bind(name.trim()).first();

    if (existing && !reupload) {
      return errorResponse(`姓名 "${name.trim()}" 已存在，请勾选"重新上传"以修改`, 409);
    }
    if (existing && reupload) {
      await env.DB.prepare('DELETE FROM records WHERE name = ?')
        .bind(name.trim()).run();
    }

    await env.DB.prepare('INSERT INTO records (name, score, rank) VALUES (?, ?, ?)')
      .bind(name.trim(), score.trim(), rank?.trim() || null).run();

    return Response.json({ message: '上传成功' });
  } catch (err) {
    return errorResponse(err.message);
  }
}

// ---------- DELETE ----------
async function handleDelete(request, env) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const password = url.searchParams.get('password');
    if (!id) return errorResponse('缺少记录 ID', 400);
    if (password !== 'admin') return errorResponse('密码错误', 403);

    const result = await env.DB.prepare('DELETE FROM records WHERE id = ?')
      .bind(id).run();
    if (result.meta.changes === 0) return errorResponse('记录不存在', 404);
    return Response.json({ message: '删除成功' });
  } catch (err) {
    return errorResponse(err.message);
  }
}

function errorResponse(message, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ---------- HTML 页面（全部内嵌） ----------
function getHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>成绩记录系统</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #f5f7fb; padding: 20px; color: #1e293b; }
    .container { max-width: 1100px; margin:0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; background: #fff; padding: 16px 24px; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 24px; }
    .header h1 { font-size: 22px; font-weight: 700; }
    .header h1 span { color: #3b82f6; }
    .stats { background: #f1f5f9; padding: 4px 16px; border-radius: 30px; font-size: 14px; }
    .stats strong { color: #0f172a; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 20px; border: none; border-radius: 30px; font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.2s; }
    .btn-primary { background: #3b82f6; color: #fff; }
    .btn-primary:hover { background: #2563eb; transform: translateY(-1px); }
    .btn-danger { background: #ef4444; color: #fff; }
    .btn-danger:hover { background: #dc2626; }
    .btn-outline { background: transparent; color: #3b82f6; border: 1.5px solid #3b82f6; }
    .btn-outline:hover { background: #eff6ff; }
    .btn-sm { padding: 4px 14px; font-size: 12px; }
    .card { background: #fff; border-radius: 16px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 24px; }
    .card-title { font-size: 17px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .badge { background: #e2e8f0; color: #475569; font-size: 12px; padding: 1px 12px; border-radius: 30px; }
    .form-row { display: flex; flex-wrap: wrap; gap: 16px 20px; align-items: flex-end; }
    .form-group { flex: 1 1 160px; min-width: 130px; }
    .form-group label { display: block; font-size: 13px; font-weight: 500; color: #475569; margin-bottom: 4px; }
    .form-group input { width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; background: #fafbfc; transition: 0.2s; }
    .form-group input:focus { outline: none; border-color: #3b82f6; background: #fff; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
    .form-check { display: flex; align-items: center; gap: 8px; padding-top: 6px; flex: 0 0 auto; }
    .form-check input[type="checkbox"] { width: 18px; height: 18px; accent-color: #3b82f6; cursor: pointer; }
    .form-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: 0 0 auto; }
    .toast { padding: 12px 18px; border-radius: 12px; font-size: 14px; font-weight: 500; margin-bottom: 16px; display: none; align-items: center; gap: 10px; border-left: 4px solid; }
    .toast.show { display: flex; }
    .toast-success { background: #f0fdf4; border-color: #22c55e; color: #166534; }
    .toast-error { background: #fef2f2; border-color: #ef4444; color: #991b1b; }
    .toast-warning { background: #fffbeb; border-color: #f59e0b; color: #92400e; }
    .table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid #eef2f6; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 480px; }
    table thead { background: #f8fafc; border-bottom: 2px solid #eef2f6; }
    table th { text-align: left; padding: 12px 16px; font-weight: 600; color: #475569; font-size: 13px; text-transform: uppercase; }
    table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    table tbody tr:hover { background: #fafbfc; }
    .text-muted { color: #94a3b8; font-size: 13px; }
    .rank-badge { background: #eef2ff; color: #4f46e5; padding: 1px 12px; border-radius: 30px; font-size: 12px; font-weight: 500; display: inline-block; }
    .time-text { font-size: 13px; color: #64748b; white-space: nowrap; }
    .empty-state { text-align: center; padding: 40px 20px; color: #94a3b8; }
    .empty-state .icon { font-size: 40px; margin-bottom: 12px; }
    .hidden { display: none !important; }
    @media (max-width: 768px) {
      .header { flex-direction: column; align-items: stretch; }
      .form-row { flex-direction: column; }
      .form-group { flex: 1 1 100%; }
      .form-actions { width: 100%; justify-content: stretch; }
      .form-actions .btn { flex: 1; }
    }
  </style>
</head>
<body>
<div class="container" id="app">
  <header class="header">
    <h1>📊 成绩<span>记录</span></h1>
    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
      <span class="stats" id="statsCount">共 <strong>0</strong> 人</span>
      <button class="btn btn-outline btn-sm" id="adminBtn">🔐 管理后台</button>
    </div>
  </header>
  <div id="toast" class="toast"></div>
  <div class="card">
    <div class="card-title">✏️ 上传成绩 <span class="badge">请勿重复上传</span></div>
    <form id="uploadForm" autocomplete="off">
      <div class="form-row">
        <div class="form-group">
          <label for="nameInput">姓名 *</label>
          <input type="text" id="nameInput" placeholder="例如：张三" required />
        </div>
        <div class="form-group">
          <label for="scoreInput">分数 *</label>
          <input type="text" id="scoreInput" placeholder="例如：650.5" required />
        </div>
        <div class="form-group">
          <label for="rankInput">排名（选填）</label>
          <input type="text" id="rankInput" placeholder="例如：第3名" />
        </div>
        <div class="form-check">
          <input type="checkbox" id="reuploadCheck" />
          <label for="reuploadCheck">🔄 重新上传</label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" id="submitBtn">📤 提交</button>
          <button type="reset" class="btn btn-outline">清空</button>
        </div>
      </div>
    </form>
  </div>
  <div class="card">
    <div class="card-title">
      📋 成绩列表
      <span class="badge" id="recordCount">0 条</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:50px;">#</th>
            <th>姓名</th>
            <th>分数</th>
            <th>排名</th>
            <th>上传时间</th>
            <th style="width:100px;" id="actionHeader" class="hidden">操作</th>
          </tr>
        </thead>
        <tbody id="recordsBody"></tbody>
      </table>
    </div>
    <div id="emptyState" class="empty-state">
      <div class="icon">📭</div>
      <p>暂无记录，赶快上传第一条吧！</p>
    </div>
  </div>
</div>
<script>
  const API_BASE = '/api/records';
  const ADMIN_PASSWORD = 'admin';
  const $ = s => document.querySelector(s);
  const nameInput = $('#nameInput');
  const scoreInput = $('#scoreInput');
  const rankInput = $('#rankInput');
  const reuploadCheck = $('#reuploadCheck');
  const submitBtn = $('#submitBtn');
  const uploadForm = $('#uploadForm');
  const recordsBody = $('#recordsBody');
  const emptyState = $('#emptyState');
  const statsCount = $('#statsCount');
  const recordCount = $('#recordCount');
  const toast = $('#toast');
  const adminBtn = $('#adminBtn');
  const actionHeader = $('#actionHeader');
  let isAdmin = false;

  function showToast(msg, type='info') {
    toast.className = 'toast show toast-' + type;
    toast.textContent = msg;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 5000);
  }

  async function loadRecords() {
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error('加载失败');
      const data = await res.json();
      renderTable(data);
      updateStats(data.length);
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  }

  function renderTable(records) {
    if (!records || records.length === 0) {
      recordsBody.innerHTML = '';
      emptyState.style.display = 'block';
      recordCount.textContent = '0 条';
      return;
    }
    emptyState.style.display = 'none';
    recordCount.textContent = records.length + ' 条';
    const sorted = [...records].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    recordsBody.innerHTML = sorted.map((r, idx) => {
      const time = formatTime(r.created_at);
      const rankHtml = r.rank ? `<span class="rank-badge">${escHtml(r.rank)}</span>` : '<span class="text-muted">—</span>';
      const delBtn = isAdmin ? `<button class="btn btn-danger btn-sm" onclick="deleteRecord(${r.id})">删除</button>` : '';
      return `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${escHtml(r.name)}</strong></td>
          <td>${escHtml(r.score)}</td>
          <td>${rankHtml}</td>
          <td class="time-text">${time}</td>
          <td>${delBtn}</td>
        </tr>
      `;
    }).join('');
    actionHeader.classList.toggle('hidden', !isAdmin);
  }

  function updateStats(count) {
    statsCount.innerHTML = `共 <strong>${count}</strong> 人`;
  }

  function formatTime(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const pad = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return iso; }
  }

  function escHtml(text) {
    if (!text) return '';
    const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  window.deleteRecord = async function(id) {
    if (!isAdmin) { showToast('请先登录管理后台', 'warning'); return; }
    if (!confirm('确定删除该记录吗？')) return;
    try {
      const res = await fetch(`${API_BASE}?id=${id}&password=${ADMIN_PASSWORD}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '删除失败');
      showToast('✅ 删除成功', 'success');
      loadRecords();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };

  adminBtn.addEventListener('click', function() {
    if (isAdmin) {
      isAdmin = false;
      adminBtn.textContent = '🔐 管理后台';
      showToast('已退出管理模式', 'info');
      loadRecords();
      return;
    }
    const pwd = prompt('请输入管理员密码：');
    if (pwd === ADMIN_PASSWORD) {
      isAdmin = true;
      adminBtn.textContent = '🚪 退出管理';
      showToast('✅ 管理员模式已开启', 'success');
      loadRecords();
    } else if (pwd !== null) {
      showToast('❌ 密码错误', 'error');
    }
  });

  uploadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = nameInput.value.trim();
    const score = scoreInput.value.trim();
    const rank = rankInput.value.trim() || null;
    const reupload = reuploadCheck.checked;
    if (!name || !score) { showToast('⚠️ 请填写姓名和分数', 'warning'); return; }
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span style="display:inline-block;width:18px;height:18px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;"></span> 提交中...';
    if (!document.getElementById('spinStyle')) {
      const style = document.createElement('style');
      style.id = 'spinStyle';
      style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
    try {
      const payload = { name, score, rank, reupload };
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '上传失败');
      showToast('✅ ' + (result.message || '上传成功！'), 'success');
      nameInput.value = '';
      scoreInput.value = '';
      rankInput.value = '';
      loadRecords();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '📤 提交';
    }
  });

  loadRecords();
</script>
</body>
</html>`;
}