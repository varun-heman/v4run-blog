-- The comments database (Cloudflare D1). Set it up once — see README → "Comments".
--   npx wrangler d1 execute v4run-blog-comments --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS comments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  post              TEXT    NOT NULL,                  -- the post's link, e.g. /2026/welcome/
  parent_id         INTEGER REFERENCES comments(id) ON DELETE CASCADE,  -- set for replies
  name              TEXT    NOT NULL,
  email             TEXT,                              -- optional, never shown publicly
  notify            INTEGER NOT NULL DEFAULT 0,        -- 1 = email this person when someone replies
  body              TEXT    NOT NULL,
  status            TEXT    NOT NULL DEFAULT 'pending', -- 'pending' (waiting for you) or 'approved'
  is_author         INTEGER NOT NULL DEFAULT 0,        -- 1 = written from /admin/ ("Author" badge)
  ip_hash           TEXT,                              -- hashed, only used to slow down floods
  unsubscribe_token TEXT,
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS comments_by_post   ON comments (post, status);
CREATE INDEX IF NOT EXISTS comments_by_status ON comments (status, created_at);
CREATE INDEX IF NOT EXISTS comments_by_ip     ON comments (ip_hash, created_at);
