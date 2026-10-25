// /api/unsubscribe?token=…  — the link at the bottom of every reply email.
// Turns off reply emails for every comment written with that email address.

const page = (title, text) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="font:18px/1.6 Georgia,serif;max-width:32rem;margin:15vh auto;padding:0 16px;background:#0b0c0b;color:#e8e8e2">
<h1 style="font:700 28px system-ui,sans-serif">${title}</h1><p>${text}</p><p><a href="/" style="color:#b8f0d2">← Back to the blog</a></p></body>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );

async function unsubscribe({ request, env }) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const row = token && (await env.DB.prepare('SELECT email FROM comments WHERE unsubscribe_token = ?').bind(token).first());
  if (!row || !row.email) return page('Link not recognised', 'This unsubscribe link has expired or was copied incompletely.');
  await env.DB.prepare('UPDATE comments SET notify = 0 WHERE email = ?').bind(row.email).run();
  return page('You’re unsubscribed', 'You won’t get any more emails about replies to your comments.');
}

// GET from the email link; POST for email apps' one-click unsubscribe button.
export const onRequestGet = unsubscribe;
export const onRequestPost = unsubscribe;
