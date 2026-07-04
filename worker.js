// ================================================================
//  成绩记录系统 — Cloudflare Pages + D1 (自动建表)
//  绑定变量名: DB  |  后台密码: admin
//  完全开箱即用，部署即运行
// ================================================================

export default {
  async fetch(request, env) {
    await ensureTable(env);

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/records') {
      const method = request.method;
      if (method === 'GET') return handleGet(env);
      if (method === 'POST') return handlePost(request, env);
      if (method === 'DELETE') return handleDelete(request, env);
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
    }

    if (path === '/' || path === '/admin') {
      return new Response(getHtml(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};

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
  } catch (_) {}
}

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
      return errorResponse('姓名 "' + name.trim() + '" 已存在，请勾选"重新上传"以修改', 409);
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

// ---------- HTML 页面（全部用字符串拼接，无嵌套模板） ----------
function getHtml() {
  return '<!DOCTYPE html>\n' +
'<html lang="zh-CN">\n' +
'<head>\n' +
'  <meta charset="UTF-8" />\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
'  <title>成绩记录系统</title>\n' +
'  <style>\n' +
'    * { margin:0; padding:0; box-sizing:border-box; }\n' +
'    body { font-family: -apple-system, system-ui, sans-serif; background: #f5f7fb; padding: 20px; color: #1e293b; }\n' +
'    .container { max-width: 1100px; margin:0 auto; }\n' +
'    .header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; background: #fff; padding: 16px 24px; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 24px; }\n' +
'    .header h1 { font-size: 22px; font-weight: 700; }\n' +
'    .header h1 span { color: #3b82f6; }\n' +
'    .stats { background: #f1f5f9; padding: 4px 16px; border-radius: 30px; font-size: 14px; }\n' +
'    .stats strong { color: #0f172a; }\n' +
'    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 20px; border: none; border-radius: 30px; font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.2s; }\n' +
'    .btn-primary { background: #3b82f6; color: #fff; }\n' +
'    .btn-primary:hover { background: #2563eb; transform: translateY(-1px); }\n' +
'    .btn-danger { background: #ef4444; color: #fff; }\n' +
'    .btn-danger:hover { background: #dc2626; }\n' +
'    .btn-outline { background: transparent; color: #3b82f6; border: 1.5px solid #3b82f6; }\n' +
'    .btn-outline:hover { background: #eff6ff; }\n' +
'    .btn-sm { padding: 4px 14px; font-size: 12px; }\n' +
'    .card { background: #fff; border-radius: 16px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 24px; }\n' +
'    .card-title { font-size: 17px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }\n' +
'    .badge { background: #e2e8f0; color: #475569; font-size: 12px; padding: 1px 12px; border-radius: 30px; }\n' +
'    .form-row { display: flex; flex-wrap: wrap; gap: 16px 20px; align-items: flex-end; }\n' +
'    .form-group { flex: 1 1 160px; min-width: 130px; }\n' +
'    .form-group label { display: block; font-size: 13px; font-weight: 500; color: #475569; margin-bottom: 4px; }\n' +
'    .form-group input { width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; background: #fafbfc; transition: 0.2s; }\n' +
'    .form-group input:focus { outline: none; border-color: #3b82f6; background: #fff; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }\n' +
'    .form-check { display: flex; align-items: center; gap: 8px; padding-top: 6px; flex: 0 0 auto; }\n' +
'    .form-check input[type="checkbox"] { width: 18px; height: 18px; accent-color: #3b82f6; cursor: pointer; }\n' +
'    .form-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: 0 0 auto; }\n' +
'    .toast { padding: 12px 18px; border-radius: 12px; font-size: 14px; font-weight: 500; margin-bottom: 16px; display: none; align-items: center; gap: 10px; border-left: 4px solid; }\n' +
'    .toast.show { display: flex; }\n' +
'    .toast-success { background: #f0fdf4; border-color: #22c55e; color: #166534; }\n' +
'    .toast-error { background: #fef2f2; border-color: #ef4444; color: #991b1b; }\n' +
'    .toast-warning { background: #fffbeb; border-color: #f59e0b; color: #92400e; }\n' +
'    .table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid #eef2f6; }\n' +
'    table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 480px; }\n' +
'    table thead { background: #f8fafc; border-bottom: 2px solid #eef2f6; }\n' +
'    table th { text-align: left; padding: 12px 16px; font-weight: 600; color: #475569; font-size: 13px; text-transform: uppercase; }\n' +
'    table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }\n' +
'    table tbody tr:hover { background: #fafbfc; }\n' +
'    .text-muted { color: #94a3b8; font-size: 13px; }\n' +
'    .rank-badge { background: #eef2ff; color: #4f46e5; padding: 1px 12px; border-radius: 30px; font-size: 12px; font-weight: 500; display: inline-block; }\n' +
'    .time-text { font-size: 13px; color: #64748b; white-space: nowrap; }\n' +
'    .empty-state { text-align: center; padding: 40px 20px; color: #94a3b8; }\n' +
'    .empty-state .icon { font-size: 40px; margin-bottom: 12px; }\n' +
'    .hidden { display: none !important; }\n' +
'    @media (max-width: 768px) {\n' +
'      .header { flex-direction: column; align-items: stretch; }\n' +
'      .form-row { flex-direction: column; }\n' +
'      .form-group { flex: 1 1 100%; }\n' +
'      .form-actions { width: 100%; justify-content: stretch; }\n' +
'      .form-actions .btn { flex: 1; }\n' +
'    }\n' +
'  </style>\n' +
'</head>\n' +
'<body>\n' +
'<div class="container" id="app">\n' +
'  <header class="header">\n' +
'    <h1>📊 成绩<span>记录</span></h1>\n' +
'    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">\n' +
'      <span class="stats" id="statsCount">共 <strong>0</strong> 人</span>\n' +
'      <button class="btn btn-outline btn-sm" id="adminBtn">🔐 管理后台</button>\n' +
'    </div>\n' +
'  </header>\n' +
'  <div id="toast" class="toast"></div>\n' +
'  <div class="card">\n' +
'    <div class="card-title">✏️ 上传成绩 <span class="badge">请勿重复上传</span></div>\n' +
'    <form id="uploadForm" autocomplete="off">\n' +
'      <div class="form-row">\n' +
'        <div class="form-group">\n' +
'          <label for="nameInput">姓名 *</label>\n' +
'          <input type="text" id="nameInput" placeholder="例如：张三" required />\n' +
'        </div>\n' +
'        <div class="form-group">\n' +
'          <label for="scoreInput">分数 *</label>\n' +
'          <input type="text" id="scoreInput" placeholder="例如：650.5" required />\n' +
'        </div>\n' +
'        <div class="form-group">\n' +
'          <label for="rankInput">排名（选填）</label>\n' +
'          <input type="text" id="rankInput" placeholder="例如：第3名" />\n' +
'        </div>\n' +
'        <div class="form-check">\n' +
'          <input type="checkbox" id="reuploadCheck" />\n' +
'          <label for="reuploadCheck">🔄 重新上传</label>\n' +
'        </div>\n' +
'        <div class="form-actions">\n' +
'          <button type="submit" class="btn btn-primary" id="submitBtn">📤 提交</button>\n' +
'          <button type="reset" class="btn btn-outline">清空</button>\n' +
'        </div>\n' +
'      </div>\n' +
'    </form>\n' +
'  </div>\n' +
'  <div class="card">\n' +
'    <div class="card-title">\n' +
'      📋 成绩列表\n' +
'      <span class="badge" id="recordCount">0 条</span>\n' +
'    </div>\n' +
'    <div class="table-wrap">\n' +
'      <table>\n' +
'        <thead>\n' +
'          <tr>\n' +
'            <th style="width:50px;">#</th>\n' +
'            <th>姓名</th>\n' +
'            <th>分数</th>\n' +
'            <th>排名</th>\n' +
'            <th>上传时间</th>\n' +
'            <th style="width:100px;" id="actionHeader" class="hidden">操作</th>\n' +
'          </tr>\n' +
'        </thead>\n' +
'        <tbody id="recordsBody"></tbody>\n' +
'      </table>\n' +
'    </div>\n' +
'    <div id="emptyState" class="empty-state">\n' +
'      <div class="icon">📭</div>\n' +
'      <p>暂无记录，赶快上传第一条吧！</p>\n' +
'    </div>\n' +
'  </div>\n' +
'</div>\n' +
'<script>\n' +
'  const API_BASE = "/api/records";\n' +
'  const ADMIN_PASSWORD = "admin";\n' +
'  const $ = s => document.querySelector(s);\n' +
'  const nameInput = $("#nameInput");\n' +
'  const scoreInput = $("#scoreInput");\n' +
'  const rankInput = $("#rankInput");\n' +
'  const reuploadCheck = $("#reuploadCheck");\n' +
'  const submitBtn = $("#submitBtn");\n' +
'  const uploadForm = $("#uploadForm");\n' +
'  const recordsBody = $("#recordsBody");\n' +
'  const emptyState = $("#emptyState");\n' +
'  const statsCount = $("#statsCount");\n' +
'  const recordCount = $("#recordCount");\n' +
'  const toast = $("#toast");\n' +
'  const adminBtn = $("#adminBtn");\n' +
'  const actionHeader = $("#actionHeader");\n' +
'  let isAdmin = false;\n' +
'\n' +
'  function showToast(msg, type) {\n' +
'    type = type || "info";\n' +
'    toast.className = "toast show toast-" + type;\n' +
'    toast.textContent = msg;\n' +
'    clearTimeout(toast._timer);\n' +
'    toast._timer = setTimeout(function() { toast.classList.remove("show"); }, 5000);\n' +
'  }\n' +
'\n' +
'  async function loadRecords() {\n' +
'    try {\n' +
'      const res = await fetch(API_BASE);\n' +
'      if (!res.ok) throw new Error("加载失败");\n' +
'      const data = await res.json();\n' +
'      renderTable(data);\n' +
'      updateStats(data.length);\n' +
'    } catch (err) {\n' +
'      showToast("❌ " + err.message, "error");\n' +
'    }\n' +
'  }\n' +
'\n' +
'  function renderTable(records) {\n' +
'    if (!records || records.length === 0) {\n' +
'      recordsBody.innerHTML = "";\n' +
'      emptyState.style.display = "block";\n' +
'      recordCount.textContent = "0 条";\n' +
'      return;\n' +
'    }\n' +
'    emptyState.style.display = "none";\n' +
'    recordCount.textContent = records.length + " 条";\n' +
'    var sorted = records.slice().sort(function(a, b) {\n' +
'      return new Date(a.created_at) - new Date(b.created_at);\n' +
'    });\n' +
'    var html = "";\n' +
'    for (var i = 0; i < sorted.length; i++) {\n' +
'      var r = sorted[i];\n' +
'      var time = formatTime(r.created_at);\n' +
'      var rankHtml = r.rank ? "<span class=\"rank-badge\">" + escHtml(r.rank) + "</span>" : "<span class=\"text-muted\">—</span>";\n' +
'      var delBtn = isAdmin ? "<button class=\"btn btn-danger btn-sm\" onclick=\"deleteRecord(" + r.id + ")\">删除</button>" : "";\n' +
'      html += "<tr>" +\n' +
'        "<td>" + (i + 1) + "</td>" +\n' +
'        "<td><strong>" + escHtml(r.name) + "</strong></td>" +\n' +
'        "<td>" + escHtml(r.score) + "</td>" +\n' +
'        "<td>" + rankHtml + "</td>" +\n' +
'        "<td class=\"time-text\">" + time + "</td>" +\n' +
'        "<td>" + delBtn + "</td>" +\n' +
'        "</tr>";\n' +
'    }\n' +
'    recordsBody.innerHTML = html;\n' +
'    actionHeader.classList.toggle("hidden", !isAdmin);\n' +
'  }\n' +
'\n' +
'  function updateStats(count) {\n' +
'    statsCount.innerHTML = "共 <strong>" + count + "</strong> 人";\n' +
'  }\n' +
'\n' +
'  function formatTime(iso) {\n' +
'    if (!iso) return "—";\n' +
'    try {\n' +
'      var d = new Date(iso);\n' +
'      var pad = function(n) { return String(n).padStart(2, "0"); };\n' +
'      return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());\n' +
'    } catch(e) { return iso; }\n' +
'  }\n' +
'\n' +
'  function escHtml(text) {\n' +
'    if (!text) return "";\n' +
'    var map = {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"};\n' +
'    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });\n' +
'  }\n' +
'\n' +
'  window.deleteRecord = async function(id) {\n' +
'    if (!isAdmin) { showToast("请先登录管理后台", "warning"); return; }\n' +
'    if (!confirm("确定删除该记录吗？")) return;\n' +
'    try {\n' +
'      var res = await fetch(API_BASE + "?id=" + id + "&password=" + ADMIN_PASSWORD, { method: "DELETE" });\n' +
'      var result = await res.json();\n' +
'      if (!res.ok) throw new Error(result.error || "删除失败");\n' +
'      showToast("✅ 删除成功", "success");\n' +
'      loadRecords();\n' +
'    } catch (err) {\n' +
'      showToast("❌ " + err.message, "error");\n' +
'    }\n' +
'  };\n' +
'\n' +
'  adminBtn.addEventListener("click", function() {\n' +
'    if (isAdmin) {\n' +
'      isAdmin = false;\n' +
'      adminBtn.textContent = "🔐 管理后台";\n' +
'      showToast("已退出管理模式", "info");\n' +
'      loadRecords();\n' +
'      return;\n' +
'    }\n' +
'    var pwd = prompt("请输入管理员密码：");\n' +
'    if (pwd === ADMIN_PASSWORD) {\n' +
'      isAdmin = true;\n' +
'      adminBtn.textContent = "🚪 退出管理";\n' +
'      showToast("✅ 管理员模式已开启", "success");\n' +
'      loadRecords();\n' +
'    } else if (pwd !== null) {\n' +
'      showToast("❌ 密码错误", "error");\n' +
'    }\n' +
'  });\n' +
'\n' +
'  uploadForm.addEventListener("submit", async function(e) {\n' +
'    e.preventDefault();\n' +
'    var name = nameInput.value.trim();\n' +
'    var score = scoreInput.value.trim();\n' +
'    var rank = rankInput.value.trim() || null;\n' +
'    var reupload = reuploadCheck.checked;\n' +
'    if (!name || !score) { showToast("⚠️ 请填写姓名和分数", "warning"); return; }\n' +
'    submitBtn.disabled = true;\n' +
'    submitBtn.innerHTML = "<span style=\"display:inline-block;width:18px;height:18px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;\"></span> 提交中...";\n' +
'    if (!document.getElementById("spinStyle")) {\n' +
'      var style = document.createElement("style");\n' +
'      style.id = "spinStyle";\n' +
'      style.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";\n' +
'      document.head.appendChild(style);\n' +
'    }\n' +
'    try {\n' +
'      var payload = { name: name, score: score, rank: rank, reupload: reupload };\n' +
'      var res = await fetch(API_BASE, {\n' +
'        method: "POST",\n' +
'        headers: { "Content-Type": "application/json" },\n' +
'        body: JSON.stringify(payload)\n' +
'      });\n' +
'      var result = await res.json();\n' +
'      if (!res.ok) throw new Error(result.error || "上传失败");\n' +
'      showToast("✅ " + (result.message || "上传成功！"), "success");\n' +
'      nameInput.value = "";\n' +
'      scoreInput.value = "";\n' +
'      rankInput.value = "";\n' +
'      loadRecords();\n' +
'    } catch (err) {\n' +
'      showToast("❌ " + err.message, "error");\n' +
'    } finally {\n' +
'      submitBtn.disabled = false;\n' +
'      submitBtn.innerHTML = "📤 提交";\n' +
'    }\n' +
'  });\n' +
'\n' +
'  loadRecords();\n' +
'</script>\n' +
'</body>\n' +
'</html>';
}