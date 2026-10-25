# What I think. — blog.v4.run

The blog half of [v4.run](https://v4.run). Posts are plain markdown files. A small script turns them into a static website, and Cloudflare Pages hosts it for free, with threaded comments stored in a free Cloudflare D1 database.

There's no framework and no admin panel for writing: you write a `.md` file, push to GitHub, and the site rebuilds.

## Contents

- [Preview on your computer](#preview-on-your-computer)
- [Writing a post](#writing-a-post)
- [What's where](#whats-where)
- [Publishing to Cloudflare (one-time setup)](#publishing-to-cloudflare-one-time-setup)
- [Comments](#comments)
- [How the build works](#how-the-build-works)
- [Not done yet](#not-done-yet)

## Preview on your computer

You need [Node.js](https://nodejs.org) 18 or newer. Then, in this folder:

```bash
npm install
```

```bash
npm run dev
```

Open **http://localhost:4321**. The page refreshes by itself whenever you save a post, a picture or a setting.

The preview shows drafts, marked with a yellow "Draft" label. Comments work with a pretend database that resets when you stop the server. The moderation page is at http://localhost:4321/admin/, and its password while previewing is `local`.

## Writing a post

The full guide is a post on the blog itself: [content/posts/2026/how-to-write-a-post.md](content/posts/2026/how-to-write-a-post.md) (or `/2026/how-to-write-a-post/` in the preview). In short:

1. Create `content/posts/<year>/<short-name>.md`. The file name becomes the link: `blog.v4.run/<year>/<short-name>/`.
2. Start it with a settings block:

   ```yaml
   ---
   title: My post
   date: 2026-10-25
   category: essays            # one of the categories in site.yml
   tags: [justice, courts]
   description: One or two sentences for cards, search and link previews.
   cover: /images/2026/photo.jpg
   cover_alt: What the photo shows
   featured: true              # optional: show it in Featured on the homepage
   ---
   ```

3. Write the post below it in markdown. Put pictures in `public/images/<year>/`.
4. Commit and push. Cloudflare publishes it in about a minute.

If a post has a mistake (no title, an unknown author or category, the wrong year folder), the build stops and names the file and the problem. The live site keeps its last good version until you fix it.

## What's where

| Path | What it is |
| --- | --- |
| `content/posts/<year>/*.md` | The posts. |
| `content/authors.yml` | Everyone who can be named as an author. |
| `site.yml` | Blog title, tagline, address, categories, comment settings. |
| `public/` | Pictures and icons, copied to the site as they are. |
| `src/build.js` | The build script: reads everything above and writes the site into `dist/`. |
| `src/markdown.js` | Markdown → HTML, including headings for the outline, figures and callouts. |
| `src/templates.js` | The HTML for every kind of page. |
| `src/assets/` | Styles and browser scripts (search, theme, outline, comments, moderation, homepage sphere). |
| `functions/api/` | The comments backend. Cloudflare runs these files on its servers. |
| `server/shared.js` | Helpers used by the comment functions (emails, passwords, checks). |
| `schema.sql` | The comments database table. Run once when setting up. |
| `scripts/dev.js` | The local preview server. |
| `dist/` | The built site. Generated, not committed. |

**Links the build creates:** posts at `/<year>/<slug>/` (and the raw markdown at `/<year>/<slug>.md`), plus `/archive/`, `/<year>/`, `/category/<key>/`, `/tag/<tag>/`, `/author/<key>/`, `/search/`, `/rss.xml` and `/sitemap.xml`. Every page carries a canonical link to its `blog.v4.run` address.

## Publishing to Cloudflare (one-time setup)

1. **Create the project.** In the [Cloudflare dashboard](https://dash.cloudflare.com), go to **Workers & Pages → Create → Pages → Connect to Git** and pick `varun-heman/v4run-blog`.
2. **Build settings:**
   - Framework preset: *None*
   - Build command: `npm run build`
   - Build output directory: `dist`
3. **Deploy.** Check the test address Cloudflare gives you (`…pages.dev`).
4. **Connect `blog.v4.run`.** First add it in the project under **Custom domains**. Then, where v4.run's DNS is managed (Netlify → Domains → v4.run → DNS), add:
   - Type `CNAME`, name `blog`, value: your `…pages.dev` address.

   Wait until Cloudflare shows the domain as *Active*. It sets up HTTPS on its own.

After this, every push to `main` publishes the blog. The main site at v4.run is not affected.

## Comments

Readers can comment and reply to each other (threaded). Nothing appears until you approve it at **blog.v4.run/admin/**, where you can also hide, delete or reply as the author (your replies get an "Author" badge).

**Setup, once:**

1. **Create the database.** In Cloudflare, go to **Storage & Databases → D1 → Create**, and name it `v4run-blog-comments`.
2. **Create the table.** Open the database's **Console** tab, paste everything from [schema.sql](schema.sql), and run it.
3. **Connect it to the blog.** In the Pages project, go to **Settings → Bindings → Add → D1 database**. Set the variable name to `DB` and pick `v4run-blog-comments`.
4. **Set a moderation password.** In **Settings → Variables and Secrets**, add `ADMIN_TOKEN` (type *Secret*) with a long password you choose. You'll type it at `/admin/`.
5. **Redeploy**, under Deployments → ⋯ → Retry deployment, so the settings take effect.

**Optional extras:** add these the same way as `ADMIN_TOKEN`, then redeploy.

| Setting | What it does |
| --- | --- |
| `OWNER_NAME` | The name on your replies from `/admin/`. Defaults to "Varun". |
| `RESEND_API_KEY`, `EMAIL_FROM`, `NOTIFY_EMAIL` | Emails via [Resend](https://resend.com)'s free plan. You get an email for each new comment (to `NOTIFY_EMAIL`). Readers who tick "Email me when someone replies" get an email when a reply to them is approved, with a one-click unsubscribe link. `EMAIL_FROM` looks like `What I think. <comments@blog.v4.run>`, and Resend shows you the DNS records to add for that address. |
| `TURNSTILE_SECRET` | Cloudflare's free, mostly invisible "are you human" check. Create a Turnstile widget for `blog.v4.run`, put its **secret key** here, and its **site key** in `site.yml` → `comments.turnstile_site_key`. |
| `AUTO_APPROVE` | `true` publishes comments without review. Not recommended. |

**Built-in spam protection:** a hidden trap field that bots fill in, a limit of 5 comments per person per 10 minutes, a check that the post really exists, and your approval before anything is shown. Emails are never shown publicly, and IP addresses are stored only as a scrambled code used for the rate limit.

## How the build works

`npm run build` runs [src/build.js](src/build.js), which:

1. Reads `site.yml`, `content/authors.yml` and every `.md` file in `content/posts/`.
2. Checks each post and collects any problems to report together.
3. Turns the markdown into HTML ([src/markdown.js](src/markdown.js)) and notes each post's headings. Posts with three or more sections get an outline.
4. Writes every page using [src/templates.js](src/templates.js), plus `search.json` (the index search uses in the browser), `rss.xml`, `sitemap.xml`, `robots.txt` and `_headers` (caching rules for Cloudflare).

It needs two small packages: `marked` (markdown) and `js-yaml` (the settings blocks). Search runs entirely in the reader's browser, so it needs no server.

## Not done yet

- **Confirming reply-notification emails.** Anyone can type an email address into the "email me" box. Emails go out only for replies you've approved, and each one has an unsubscribe link, so misuse is limited. A "confirm your email" step would close the gap completely.
- **Blog posts on the v4.run homepage.** The main site's Writing carousel doesn't pull from this blog's RSS feed yet. That work belongs in the `v4run-website` repo.
