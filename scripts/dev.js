#!/usr/bin/env node
// Local preview: `npm run dev`, then open http://localhost:4321
//
// - Rebuilds and refreshes the browser whenever you save a post, image or setting.
// - Shows drafts (they're marked "Draft").
// - Comments work with a pretend, in-memory database so you can try them out.
//   Nothing is saved, and they reset when you stop the server.
//   /admin/ password while previewing: local

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 4321;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function build() {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'src/build.js')], { env: { ...process.env, DEV: '1', DRAFTS: '1' }, stdio: 'inherit' });
  return r.status === 0;
}

// ── Pretend comments database ────────────────────────────────────────────
let nextId = 1;
const comments = [];
const add = (c) => { const row = { id: nextId++, parent_id: null, is_author: 0, status: 'approved', email: '', notify: 0, created_at: new Date(Date.now() - (c.ago || 0) * 3600e3).toISOString(), ...c }; delete row.ago; comments.push(row); return row; };
const first = add({ post: '/2026/welcome/', name: 'Asha', body: 'Congratulations on the new blog! Will you write more about the court work?', ago: 50 });
const reply = add({ post: '/2026/welcome/', parent_id: first.id, name: 'Varun', is_author: 1, body: 'Thank you! Yes — that’s the plan. Field notes from the districts first.', ago: 30 });
add({ post: '/2026/welcome/', parent_id: reply.id, name: 'Asha', body: 'Looking forward to it.', ago: 20 });
add({ post: '/2026/welcome/', name: 'Rohan', body: 'The reading experience here is lovely.\n\nSubscribed via RSS: https://blog.v4.run/rss.xml', ago: 6 });
add({ post: '/2026/welcome/', name: 'Someone new', body: 'This one is waiting for approval — try approving it at /admin/ (password: local).', status: 'pending', ago: 1 });

function readBody(req) {
  return new Promise((resolve) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); } }); });
}
const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };

async function api(req, res, url) {
  if (url.pathname === '/api/comments' && req.method === 'GET') {
    const post = url.searchParams.get('post');
    return send(res, 200, { comments: comments.filter((c) => c.post === post && c.status === 'approved').map(({ email, notify, status, ...c }) => c) });
  }
  if (url.pathname === '/api/comments' && req.method === 'POST') {
    const b = await readBody(req);
    if (b.website) return send(res, 200, { ok: true, status: 'pending' });
    if (!String(b.name || '').trim()) return send(res, 400, { error: 'Please add your name.' });
    if (String(b.body || '').trim().length < 2) return send(res, 400, { error: 'Please write a comment first.' });
    const c = add({ post: b.post, parent_id: b.parent_id || null, name: b.name.trim(), email: b.email || '', notify: b.notify ? 1 : 0, body: b.body.trim(), status: 'pending' });
    console.log(`  New comment from ${c.name} — approve it at http://localhost:${PORT}/admin/ (password: local)`);
    return send(res, 201, { ok: true, status: 'pending', id: c.id });
  }
  if (url.pathname === '/api/admin/comments') {
    if ((req.headers.authorization || '') !== 'Bearer local') return send(res, 401, { error: 'Wrong password. While previewing it’s: local' });
    if (req.method === 'GET') {
      const status = url.searchParams.get('status') === 'approved' ? 'approved' : 'pending';
      return send(res, 200, { comments: comments.filter((c) => c.status === status).slice().reverse() });
    }
    const { id, action, body } = await readBody(req);
    const c = comments.find((x) => x.id === Number(id));
    if (!c) return send(res, 404, { error: 'That comment no longer exists.' });
    if (action === 'approve') c.status = 'approved';
    else if (action === 'hide') c.status = 'pending';
    else if (action === 'delete') {
      const gone = new Set([c.id]);
      comments.forEach((x) => { if (gone.has(x.parent_id)) gone.add(x.id); });
      for (let i = comments.length - 1; i >= 0; i--) if (gone.has(comments[i].id)) comments.splice(i, 1);
    } else if (action === 'reply') {
      c.status = 'approved';
      add({ post: c.post, parent_id: c.id, name: 'Varun', is_author: 1, body: String(body || '').trim() });
    }
    return send(res, 200, { ok: true });
  }
  send(res, 404, { error: 'Not found' });
}

// ── Static files + live reload ───────────────────────────────────────────
const listeners = new Set();

function serveFile(res, file, status = 200) {
  res.writeHead(status, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(':\n\n');
    listeners.add(res);
    req.on('close', () => listeners.delete(res));
    return;
  }
  if (url.pathname.startsWith('/api/')) return api(req, res, url);

  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }); return res.end(); }
    file = path.join(file, 'index.html');
  }
  if (fs.existsSync(file)) return serveFile(res, file);
  serveFile(res, path.join(DIST, '404.html'), 404);
});

let timer = null;
function rebuildSoon() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (build()) listeners.forEach((res) => res.write('data: reload\n\n'));
  }, 120);
}
for (const target of ['content', 'public', 'src', 'site.yml']) {
  const p = path.join(ROOT, target);
  if (fs.existsSync(p)) fs.watch(p, { recursive: true }, rebuildSoon);
}

build();
server.listen(PORT, () => {
  console.log(`\n  Blog preview: http://localhost:${PORT}\n  Comment moderation: http://localhost:${PORT}/admin/  (password: local)\n`);
});
