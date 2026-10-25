// GET  /api/comments?post=/2026/welcome/  → the published comments for a post
// POST /api/comments                      → submit a new comment (waits for approval)

import { json, fail, POST_PATH, sha256, randomToken, sendEmail, notifyParent, escapeHtml } from '../../server/shared.js';

const MAX_PER_10_MIN = 5;

export async function onRequestGet({ request, env }) {
  const post = new URL(request.url).searchParams.get('post') || '';
  if (!POST_PATH.test(post)) return fail('Unknown post.');
  const { results } = await env.DB.prepare(
    `SELECT id, parent_id, name, body, is_author, created_at FROM comments
     WHERE post = ? AND status = 'approved' ORDER BY created_at ASC, id ASC`
  ).bind(post).all();
  return json({ comments: results });
}

export async function onRequestPost({ request, env }) {
  let input;
  try { input = await request.json(); } catch { return fail('Something went wrong sending that. Please try again.'); }

  // Bots fill in the hidden "website" field; pretend it worked and drop it.
  if (input.website) return json({ ok: true, status: 'pending' });

  const post = String(input.post || '');
  const name = String(input.name || '').trim().slice(0, 60);
  const body = String(input.body || '').trim();
  const email = String(input.email || '').trim().toLowerCase().slice(0, 254);
  const notify = Boolean(input.notify && email);
  const parentId = input.parent_id ? Number(input.parent_id) : null;

  if (!POST_PATH.test(post)) return fail('Unknown post.');
  if (!name) return fail('Please add your name.');
  if (body.length < 2) return fail('Please write a comment first.');
  if (body.length > 5000) return fail('That’s a bit long — please keep it under 5,000 characters.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('That email doesn’t look right.');

  // The post must really exist on the site.
  const page = await env.ASSETS.fetch(new URL(post, request.url));
  if (!page.ok) return fail('Unknown post.');

  if (parentId) {
    const parent = await env.DB.prepare(`SELECT id FROM comments WHERE id = ? AND post = ? AND status = 'approved'`).bind(parentId, post).first();
    if (!parent) return fail('The comment you’re replying to isn’t there any more.');
  }

  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (env.TURNSTILE_SECRET) {
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET);
    form.append('response', String(input.turnstile || ''));
    if (ip) form.append('remoteip', ip);
    const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form }).then((r) => r.json()).catch(() => ({}));
    if (!check.success) return fail('Couldn’t confirm you’re human. Please try again.', 403);
  }

  const ipHash = ip ? await sha256(`${ip}:${env.ADMIN_TOKEN || ''}`) : null;
  if (ipHash) {
    const recent = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM comments WHERE ip_hash = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-10 minutes')`
    ).bind(ipHash).first();
    if (recent && recent.n >= MAX_PER_10_MIN) return fail('You’re commenting quickly — please wait a few minutes.', 429);
  }

  const status = env.AUTO_APPROVE === 'true' ? 'approved' : 'pending';
  const row = await env.DB.prepare(
    `INSERT INTO comments (post, parent_id, name, email, notify, body, status, ip_hash, unsubscribe_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, created_at`
  ).bind(post, parentId, name, email || null, notify ? 1 : 0, body, status, ipHash, randomToken()).first();

  const origin = new URL(request.url).origin;
  if (status === 'approved') {
    await notifyParent(env, origin, { id: row.id, post, parent_id: parentId, name, email, body });
  } else if (env.NOTIFY_EMAIL) {
    await sendEmail(env, {
      to: env.NOTIFY_EMAIL,
      subject: `New comment from ${name} — waiting for approval`,
      text: `${name}${email ? ` <${email}>` : ''} on ${origin}${post}\n\n${body}\n\nApprove or delete: ${origin}/admin/`,
      html: `<p><strong>${escapeHtml(name)}</strong>${email ? ` &lt;${escapeHtml(email)}&gt;` : ''} on <a href="${origin}${post}">${escapeHtml(post)}</a></p><blockquote style="border-left:3px solid #0d7a48;margin:0;padding-left:12px">${escapeHtml(body).replace(/\n/g, '<br>')}</blockquote><p><a href="${origin}/admin/">Approve or delete →</a></p>`,
    });
  }

  return json({ ok: true, status, id: row.id }, 201);
}
