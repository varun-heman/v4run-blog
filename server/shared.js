// Helpers shared by the Cloudflare functions in functions/api/.
// Settings come from Cloudflare → your Pages project → Settings → Variables and Secrets:
//   ADMIN_TOKEN       password for /admin/                         (required)
//   OWNER_NAME        name shown on your replies, e.g. "Varun"     (optional)
//   RESEND_API_KEY    turns on emails                              (optional)
//   EMAIL_FROM        e.g. "What I think. <comments@blog.v4.run>"  (needed for emails)
//   NOTIFY_EMAIL      where "new comment" emails go               (optional)
//   TURNSTILE_SECRET  turns on the spam check                      (optional)
//   AUTO_APPROVE      "true" publishes comments without review     (optional, not recommended)

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export const fail = (error, status = 400) => json({ error }, status);

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const POST_PATH = /^\/\d{4}\/[a-z0-9-]+\/$/;

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const randomToken = () => [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, '0')).join('');

// Same-length comparison so the admin password can't be guessed by timing.
export function sameSecret(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAdmin(request, env) {
  const header = request.headers.get('Authorization') || '';
  return sameSecret(header.replace(/^Bearer\s+/i, ''), env.ADMIN_TOKEN || '');
}

// Sends one email through Resend. Quietly does nothing if emails aren't set up,
// and never lets an email problem break a comment.
export async function sendEmail(env, { to, subject, text, html, unsubscribe }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !to) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        subject,
        text,
        html,
        headers: unsubscribe ? { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined,
      }),
    });
    if (!res.ok) console.error('Resend error', res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error('Email failed', err);
    return false;
  }
}

// When a reply goes live, tell the person being replied to — if they asked.
export async function notifyParent(env, origin, reply) {
  if (!reply.parent_id) return;
  const parent = await env.DB.prepare('SELECT id, name, email, notify, unsubscribe_token FROM comments WHERE id = ?').bind(reply.parent_id).first();
  if (!parent || !parent.notify || !parent.email) return;
  if (reply.email && reply.email.toLowerCase() === parent.email.toLowerCase()) return; // replying to yourself

  const link = `${origin}${reply.post}#comment-${reply.id}`;
  const unsubscribe = `${origin}/api/unsubscribe?token=${parent.unsubscribe_token}`;
  const excerpt = reply.body.length > 400 ? reply.body.slice(0, 400) + '…' : reply.body;
  await sendEmail(env, {
    to: parent.email,
    subject: `${reply.name} replied to your comment`,
    unsubscribe,
    text: `Hi ${parent.name},\n\n${reply.name} replied to your comment:\n\n${excerpt}\n\nRead and reply: ${link}\n\n—\nStop these emails: ${unsubscribe}`,
    html: `<p>Hi ${escapeHtml(parent.name)},</p><p><strong>${escapeHtml(reply.name)}</strong> replied to your comment:</p><blockquote style="border-left:3px solid #0d7a48;margin:0;padding-left:12px;color:#333">${escapeHtml(excerpt).replace(/\n/g, '<br>')}</blockquote><p><a href="${link}">Read and reply →</a></p><p style="color:#888;font-size:12px"><a href="${unsubscribe}" style="color:#888">Stop emails about replies</a></p>`,
  });
}
