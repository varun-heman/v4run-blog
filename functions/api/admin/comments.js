// Used by the /admin/ page. Every request needs the ADMIN_TOKEN password.
// GET  /api/admin/comments?status=pending|approved  → comments, newest first (with emails)
// POST /api/admin/comments  { id, action }           → action: approve | hide | delete | reply (with `body`)

import { json, fail, isAdmin, notifyParent, randomToken } from '../../../server/shared.js';

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return fail('Wrong password.', 401);
  const status = new URL(request.url).searchParams.get('status') === 'approved' ? 'approved' : 'pending';
  const { results } = await env.DB.prepare(
    `SELECT id, post, parent_id, name, email, notify, body, status, is_author, created_at
     FROM comments WHERE status = ? ORDER BY created_at DESC LIMIT 200`
  ).bind(status).all();
  return json({ comments: results });
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return fail('Wrong password.', 401);
  const { id, action, body } = await request.json().catch(() => ({}));
  const comment = await env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(Number(id)).first();
  if (!comment) return fail('That comment no longer exists.', 404);
  const origin = new URL(request.url).origin;

  if (action === 'approve') {
    await env.DB.prepare(`UPDATE comments SET status = 'approved' WHERE id = ?`).bind(comment.id).run();
    // Reply emails go out only now, once you've approved — never for unreviewed text.
    if (comment.status !== 'approved') await notifyParent(env, origin, comment);
    return json({ ok: true });
  }

  if (action === 'hide') {
    await env.DB.prepare(`UPDATE comments SET status = 'pending' WHERE id = ?`).bind(comment.id).run();
    return json({ ok: true });
  }

  if (action === 'delete') {
    await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(comment.id).run();
    return json({ ok: true });
  }

  if (action === 'reply') {
    const text = String(body || '').trim();
    if (!text) return fail('Write a reply first.');
    // Replying to a waiting comment approves it, so your reply isn't left hanging.
    if (comment.status !== 'approved') {
      await env.DB.prepare(`UPDATE comments SET status = 'approved' WHERE id = ?`).bind(comment.id).run();
      await notifyParent(env, origin, comment);
    }
    const name = env.OWNER_NAME || 'Varun';
    const row = await env.DB.prepare(
      `INSERT INTO comments (post, parent_id, name, body, status, is_author, unsubscribe_token)
       VALUES (?, ?, ?, ?, 'approved', 1, ?) RETURNING id`
    ).bind(comment.post, comment.id, name, text, randomToken()).first();
    await notifyParent(env, origin, { id: row.id, post: comment.post, parent_id: comment.id, name, email: null, body: text });
    return json({ ok: true, id: row.id });
  }

  return fail('Unknown action.');
}
