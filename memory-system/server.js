require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const http = require('http');
const url = require('url');
const { createClient } = require('@supabase/supabase-js');
const { searchMemory } = require('./memory');
const config = require('../config-loader');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const PORT = 3456;

async function handleAPI(req, res) {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;
  res.setHeader('Content-Type', 'application/json');

  // 获取所有记忆
  if (path === '/api/memories' && req.method === 'GET') {
    const { type, limit = 100 } = parsed.query;
    let query = supabase
      .from('memories')
      .select('id, content, memory_type, importance, created_at')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    
    if (type && type !== 'all') {
      query = query.eq('memory_type', type);
    }
    
    const { data, error } = await query;
    if (error) {
      res.end(JSON.stringify({ error: error.message }));
      return;
    }
    // 转换字段名以匹配前端
    const rows = data.map(r => ({
      id: r.id,
      content: r.content,
      type: r.memory_type,
      importance: r.importance,
      created_at: r.created_at
    }));
    res.end(JSON.stringify(rows));
    return;
  }

  // 搜索记忆
  if (path === '/api/search' && req.method === 'GET') {
    const { q, threshold = 0.5 } = parsed.query;
    if (!q) { res.end('[]'); return; }
    try {
      const results = await searchMemory(q, parseFloat(threshold), 20);
      // 添加score字段
      const formatted = results.map(r => ({
        id: r.id,
        content: r.content,
        type: r.memory_type,
        importance: r.importance,
        created_at: r.created_at,
        score: r.similarity
      }));
      res.end(JSON.stringify(formatted));
    } catch (e) {
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 删除记忆
  if (path === '/api/delete' && req.method === 'POST') {
    const body = await getBody(req);
    let parsed;
    try { parsed = JSON.parse(body); } catch { res.end(JSON.stringify({ error: 'invalid JSON' })); return; }
    const { id } = parsed;
    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', id);
    if (error) {
      res.end(JSON.stringify({ error: error.message }));
      return;
    }
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // 统计
  if (path === '/api/stats' && req.method === 'GET') {
    const { data: allData } = await supabase
      .from('memories')
      .select('id, memory_type, created_at');
    
    const total = allData ? allData.length : 0;
    
    // 按类型统计
    const typeCounts = {};
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let recent = 0;
    
    if (allData) {
      allData.forEach(r => {
        typeCounts[r.memory_type] = (typeCounts[r.memory_type] || 0) + 1;
        if (new Date(r.created_at) > sevenDaysAgo) recent++;
      });
    }
    
    const types = Object.entries(typeCounts).map(([type, c]) => ({ type, c }));
    res.end(JSON.stringify({ total, types, recent }));
    return;
  }

  // 获取叙事摘要
  if (path === '/api/summaries' && req.method === 'GET') {
    const { data, error } = await supabase
      .from('narrative_summaries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      res.end(JSON.stringify({ error: error.message }));
      return;
    }
    res.end(JSON.stringify(data || []));
    return;
  }

  // 更新叙事摘要
  if (path === '/api/update-summary' && req.method === 'POST') {
    const body = await getBody(req);
    let parsed;
    try { parsed = JSON.parse(body); } catch { res.end(JSON.stringify({ error: 'invalid JSON' })); return; }
    const { id, summary } = parsed;
    const { error } = await supabase
      .from('narrative_summaries')
      .update({ summary })
      .eq('id', id);
    
    if (error) {
      res.end(JSON.stringify({ error: error.message }));
      return;
    }
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // 更新记忆
  if (path === '/api/update-memory' && req.method === 'POST') {
    const body = await getBody(req);
    let parsed;
    try { parsed = JSON.parse(body); } catch { res.end(JSON.stringify({ error: 'invalid JSON' })); return; }
    const { id, content } = parsed;
    // 重新生成 embedding 向量
    let updateData = { content };
    try {
      const { getEmbedding } = require('./memory');
      const embedding = await getEmbedding(content);
      updateData.embedding = embedding;
    } catch (e) {
      console.error('[update-memory] embedding regeneration failed:', e.message);
    }
    const { error } = await supabase
      .from('memories')
      .update(updateData)
      .eq('id', id);
    
    if (error) {
      res.end(JSON.stringify({ error: error.message }));
      return;
    }
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.statusCode = 404;
  res.end('{"error":"not found"}');
}

function getBody(req) {
  return new Promise(r => {
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => r(d));
  });
}

function getHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${config.ai.name}的记忆面板</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;background:#fef5f0;color:#333}
.header{background:linear-gradient(135deg,#ffc4d6,#ffb5c9);padding:24px 32px;border-bottom:1px solid #f0d0d8}
.header h1{font-size:22px;color:#5a3a42}
.stats{display:flex;gap:16px;margin-top:16px;flex-wrap:wrap}
.stat{background:#fff;border:1px solid #f0d0d8;border-radius:8px;padding:12px 20px;box-shadow:0 2px 4px rgba(0,0,0,.05)}
.stat .n{font-size:28px;font-weight:700;color:#e57ba0}
.stat .l{font-size:12px;opacity:.6;color:#666}
.container{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:20px 32px}
.section{background:#fff;border:1px solid #f0d0d8;border-radius:8px;padding:20px;box-shadow:0 2px 4px rgba(0,0,0,.05)}
.section h2{font-size:16px;margin-bottom:16px;color:#e57ba0}
.bar{padding:12px 0;display:flex;gap:12px;flex-wrap:wrap;align-items:center;border-bottom:1px solid #f0d0d8;margin-bottom:16px}
input[type=text],textarea{flex:1;min-width:200px;padding:10px 14px;background:#fef5f0;border:1px solid #f0d0d8;border-radius:6px;color:#333;font-size:14px;outline:none;font-family:-apple-system,sans-serif}
input:focus,textarea:focus{border-color:#e57ba0}
textarea{width:100%;resize:vertical;min-height:80px}
select,button{padding:10px 16px;border-radius:6px;border:1px solid #f0d0d8;background:#fff;color:#333;cursor:pointer;font-size:13px}
button{background:#e57ba0;color:#fff;border:none;font-weight:600}
button:hover{background:#d96b90}
button.del{background:transparent;color:#e57ba0;font-size:12px;padding:4px 10px;border:1px solid #e57ba0}
button.del:hover{background:#e57ba0;color:#fff}
button.edit{background:transparent;color:#e57ba0;font-size:12px;padding:4px 10px;border:1px solid #e57ba0;margin-left:8px}
button.edit:hover{background:#e57ba0;color:#fff}
button.save{background:#ffc4d6;color:#5a3a42;font-size:12px;padding:4px 10px;margin-right:8px}
button.cancel{background:#f0d0d8;color:#5a3a42;font-size:12px;padding:4px 10px}
.list{max-height:calc(100vh - 200px);overflow-y:auto}
.card{background:#fff;border:1px solid #f0d0d8;border-radius:8px;padding:16px;margin-bottom:10px;position:relative;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.card .meta{display:flex;gap:10px;margin-bottom:8px;font-size:12px;opacity:.6;color:#666}
.card .content{font-size:14px;line-height:1.6;color:#333}
.card .score{position:absolute;top:16px;right:16px;background:#e57ba0;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px}
.card .actions{margin-top:10px;text-align:right}
.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;margin-right:6px}
.tag.fact{background:#d4f4dd;color:#2d5f3d}
.tag.event{background:#fff4d4;color:#6b5a2d}
.tag.preference{background:#f4d4f4;color:#5a2d6b}
.empty{text-align:center;padding:60px;opacity:.3;font-size:16px;color:#999}
.summary-card{background:#fff;border:1px solid #f0d0d8;border-radius:8px;padding:16px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.summary-card .time{font-size:12px;opacity:.6;margin-bottom:8px;color:#666}
.summary-card .text{font-size:14px;line-height:1.6;margin-bottom:12px;color:#333}
.summary-card .details{font-size:12px;opacity:.7;margin-top:8px;padding-top:8px;border-top:1px solid #f0d0d8;color:#666}
</style></head>
<body>
<div class="header">
  <h1>🧠 ${config.ai.name}的记忆面板</h1>
  <div class="stats" id="stats"></div>
</div>
<div class="container">
  <div class="section">
    <h2>📖 叙事摘要</h2>
    <div class="list" id="summaries"></div>
  </div>
  <div class="section">
    <h2>💭 记忆碎片</h2>
    <div class="bar">
      <input type="text" id="q" placeholder="搜索记忆..." />
      <select id="typeFilter">
        <option value="all">全部类型</option>
        <option value="fact">事实</option>
        <option value="event">事件</option>
        <option value="preference">偏好</option>
      </select>
      <button onclick="doSearch()">搜索</button>
      <button onclick="loadAll()" style="background:#2a2a4a">全部</button>
    </div>
    <div class="list" id="list"></div>
  </div>
</div>

<script>
const $ = id => document.getElementById(id);

async function loadStats() {
  const r = await fetch('/api/stats').then(r=>r.json());
  let h = '<div class="stat"><div class="n">'+r.total+'</div><div class="l">总记忆</div></div>';
  h += '<div class="stat"><div class="n">'+r.recent+'</div><div class="l">近7天</div></div>';
  r.types.forEach(t => {
    h += '<div class="stat"><div class="n">'+t.c+'</div><div class="l">'+t.type+'</div></div>';
  });
  $('stats').innerHTML = h;
}

async function loadSummaries() {
  const r = await fetch('/api/summaries').then(r=>r.json());
  if (!r.length) {
    $('summaries').innerHTML = '<div class="empty">暂无摘要</div>';
    return;
  }
  let h = '';
  r.forEach(s => {
    const time = new Date(s.created_at).toLocaleString('zh-CN');
    h += '<div class="summary-card" id="sum-'+s.id+'">';
    h += '<div class="time">'+s.session_tag+' · '+time+'</div>';
    h += '<div class="text" id="text-'+s.id+'">'+escHtml(s.summary)+'</div>';
    if (s.emotional_context) h += '<div class="details">💭 '+escHtml(s.emotional_context)+'</div>';
    if (s.key_facts && s.key_facts.length) h += '<div class="details">📌 '+s.key_facts.join(' | ')+'</div>';
    if (s.continuation_anchor) h += '<div class="details">➡️ '+escHtml(s.continuation_anchor)+'</div>';
    h += '<div class="actions">';
    h += '<button class="edit" onclick="editSummary(\\''+s.id+'\\',\\''+escAttr(s.summary)+'\\')">编辑</button>';
    h += '</div>';
    h += '</div>';
  });
  $('summaries').innerHTML = h;
}

function editSummary(id, current) {
  const card = $('sum-'+id);
  const textDiv = $('text-'+id);
  const original = textDiv.innerHTML;
  
  textDiv.innerHTML = '<textarea id="edit-'+id+'">'+current+'</textarea>';
  const actions = card.querySelector('.actions');
  actions.innerHTML = '<button class="save" onclick="saveSummary(\\''+id+'\\')">保存</button><button class="cancel" onclick="cancelEdit(\\''+id+'\\',\\''+escAttr(original)+'\\')">取消</button>';
}

async function saveSummary(id) {
  const textarea = $('edit-'+id);
  const newText = textarea.value.trim();
  if (!newText) { alert('摘要不能为空'); return; }
  
  await fetch('/api/update-summary', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({id, summary: newText})
  });
  
  loadSummaries();
}

function cancelEdit(id, original) {
  $('text-'+id).innerHTML = original;
  loadSummaries();
}

async function loadAll() {
  $('q').value = '';
  const type = $('typeFilter').value;
  const r = await fetch('/api/memories?type='+type+'&limit=200').then(r=>r.json());
  render(r, false);
}

async function doSearch() {
  const q = $('q').value.trim();
  if (!q) { loadAll(); return; }
  const r = await fetch('/api/search?q='+encodeURIComponent(q)+'&threshold=0.4').then(r=>r.json());
  render(r, true);
}

async function doDelete(id) {
  if (!confirm('确定删除这条记忆？')) return;
  await fetch('/api/delete', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({id})
  });
  loadStats();
  loadAll();
}

function render(items, showScore) {
  if (!items.length) {
    $('list').innerHTML = '<div class="empty">没有找到记忆</div>';
    return;
  }
  let h = '';
  items.forEach(m => {
    const type = m.type || 'fact';
    const time = m.created_at ? new Date(m.created_at).toLocaleString('zh-CN') : '';
    const score = m.score ? (m.score * 100).toFixed(0) + '%' : '';
    h += '<div class="card" id="mem-'+m.id+'">';
    h += '<div class="meta"><span class="tag '+type+'">'+type+'</span><span>'+time+'</span></div>';
    h += '<div class="content" id="memtext-'+m.id+'">'+escHtml(m.content)+'</div>';
    if (showScore && score) h += '<div class="score">'+score+'</div>';
    h += '<div class="actions">';
    h += '<button class="edit" onclick="editMemory(\\''+m.id+'\\',\\''+escAttr(m.content)+'\\')">编辑</button>';
    h += '<button class="del" onclick="doDelete(\\''+m.id+'\\')">删除</button>';
    h += '</div>';
    h += '</div>';
  });
  $('list').innerHTML = h;
}

function editMemory(id, current) {
  const card = $('mem-'+id);
  const textDiv = $('memtext-'+id);
  const original = textDiv.innerHTML;
  
  textDiv.innerHTML = '<textarea id="memedit-'+id+'">'+current+'</textarea>';
  const actions = card.querySelector('.actions');
  actions.innerHTML = '<button class="save" onclick="saveMemory(\\''+id+'\\')">保存</button><button class="cancel" onclick="cancelEditMemory(\\''+id+'\\',\\''+escAttr(original)+'\\')">取消</button>';
}

async function saveMemory(id) {
  const textarea = $('memedit-'+id);
  const newText = textarea.value.trim();
  if (!newText) { alert('内容不能为空'); return; }
  
  await fetch('/api/update-memory', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({id, content: newText})
  });
  
  loadAll();
}

function cancelEditMemory(id, original) {
  $('memtext-'+id).innerHTML = original;
  loadAll();
}

function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');
}

function escAttr(s) {
  if (!s) return '';
  return s.replace(/'/g,'&apos;').replace(/"/g,'&quot;').replace(/\\n/g,' ');
}

$('q').addEventListener('keydown', e => { if(e.key==='Enter') doSearch(); });
$('typeFilter').addEventListener('change', () => { loadAll(); });

loadStats();
loadSummaries();
loadAll();
</script>
</body></html>`;
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    await handleAPI(req, res);
  } else {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(getHTML());
  }
});

server.listen(PORT, () => {
  console.log(`🧠 ${config.ai.name}的记忆面板已启动: http://localhost:${PORT}`);
});
