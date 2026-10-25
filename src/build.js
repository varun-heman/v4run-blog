#!/usr/bin/env node
// Builds the whole blog into dist/.
//
//   content/posts/<year>/<slug>.md  →  dist/<year>/<slug>/index.html   (+ the raw .md beside it)
//
// Also writes: home, archive, year / category / tag / author pages, search index,
// RSS feed, sitemap, 404 and the comment-moderation page.
// Run with `npm run build`. Set DRAFTS=1 to include posts marked `draft: true`.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');
const { render, slugify, escapeHtml, stripTags } = require('./markdown');
const T = require('./templates');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const DEV = process.env.DEV === '1';
const SHOW_DRAFTS = process.env.DRAFTS === '1';
const WORDS_PER_MINUTE = 230;

// Build problems are collected and shown together, in plain language.
const problems = [];
const problem = (file, msg) => problems.push(`  • ${path.relative(ROOT, file)}: ${msg}`);

function readYaml(file) {
  return yaml.load(fs.readFileSync(path.join(ROOT, file), 'utf8')) || {};
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : d.name.endsWith('.md') ? [p] : [];
  });
}

function toDate(value) {
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return isNaN(d) ? null : d;
}

const toList = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : String(v).split(',')).map((s) => String(s).trim()).filter(Boolean);

function write(rel, contents) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, to, { recursive: true, filter: (src) => !path.basename(src).startsWith('.') });
}

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

// ── Load ────────────────────────────────────────────────────────────────────

function load() {
  const site = readYaml('site.yml');
  site.url = String(site.url).replace(/\/$/, '');
  site.comments = site.comments || { enabled: false };

  const authors = {};
  for (const [key, a] of Object.entries(readYaml('content/authors.yml'))) {
    authors[key] = {
      key,
      ...a,
      initials: a.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(),
      url_path: `/author/${key}/`,
      posts: [],
    };
  }

  const categories = {};
  for (const [key, c] of Object.entries(site.categories || {})) {
    categories[key] = { key, ...c, url_path: `/category/${key}/`, posts: [] };
  }

  const tags = {};
  const posts = [];
  const seenUrls = new Map();

  for (const file of walk(path.join(ROOT, 'content/posts'))) {
    const raw = fs.readFileSync(file, 'utf8');
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) { problem(file, 'is missing its front matter (the block between the two --- lines at the top).'); continue; }

    let fm;
    try { fm = yaml.load(m[1]) || {}; } catch (err) { problem(file, `front matter isn't valid: ${err.reason || err.message}`); continue; }
    const markdown = m[2];

    if (fm.draft && !SHOW_DRAFTS) continue;
    if (!fm.title) { problem(file, 'needs a `title:`.'); continue; }
    const date = toDate(fm.date);
    if (!date) { problem(file, 'needs a `date:` like 2026-10-25.'); continue; }

    const slug = slugify(fm.slug || path.basename(file, '.md'));
    const year = date.getUTCFullYear();
    const folderYear = path.basename(path.dirname(file));
    if (/^\d{4}$/.test(folderYear) && Number(folderYear) !== year) {
      problem(file, `is in the ${folderYear} folder but dated ${year}. Move it to content/posts/${year}/ (the link uses the date).`);
    }

    const url = `/${year}/${slug}/`;
    if (seenUrls.has(url)) { problem(file, `has the same link (${url}) as ${path.relative(ROOT, seenUrls.get(url))}. Rename one of them.`); continue; }
    seenUrls.set(url, file);

    const authorKeys = toList(fm.author || fm.authors || site.default_author);
    const postAuthors = authorKeys.map((k) => authors[k]).filter(Boolean);
    authorKeys.filter((k) => !authors[k]).forEach((k) => problem(file, `names author "${k}", who isn't in content/authors.yml.`));
    if (!postAuthors.length) continue;

    let category = null;
    if (fm.category) {
      category = categories[slugify(fm.category)];
      if (!category) problem(file, `uses category "${fm.category}", which isn't listed in site.yml. Add it there or pick one of: ${Object.keys(categories).join(', ')}.`);
    }

    const postTags = toList(fm.tags).map((name) => {
      const key = slugify(name);
      tags[key] = tags[key] || { key, name, url_path: `/tag/${key}/`, posts: [] };
      return tags[key];
    });

    const { html, headings } = render(markdown, { siteUrl: site.url });
    // Plain text of the post, for reading time and search (code blocks and "#" anchors left out).
    const text = stripTags(
      html.replace(/<pre[\s\S]*?<\/pre>/g, ' ').replace(/<a class="anchor"[^>]*>#<\/a>/g, '').replace(/<\/(p|h\d|li|td|th|figcaption|blockquote|aside)>/g, ' ')
    ).replace(/\s+/g, ' ').trim();
    const words = text.split(' ').length;
    const firstPara = stripTags((html.match(/<p>([\s\S]*?)<\/p>/) || [, ''])[1]).trim();
    const excerpt = fm.description || (firstPara.length > 180 ? firstPara.slice(0, 177).replace(/\s+\S*$/, '') + '…' : firstPara);

    posts.push({
      file, slug, year, url, date,
      updated: fm.updated ? toDate(fm.updated) : null,
      title: String(fm.title),
      description: fm.description || '',
      excerpt,
      cover: fm.cover || null,
      cover_alt: fm.cover_alt || '',
      cover_caption: fm.cover_caption || '',
      featured: Boolean(fm.featured),
      draft: Boolean(fm.draft),
      comments: fm.comments,
      authors: postAuthors,
      category,
      tags: postTags,
      markdown: raw,
      html, headings, text,
      readingTime: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
      // Outline: on when asked (`outline: true`), off when asked (`outline: false`),
      // otherwise automatic for posts with 3+ sections.
      showOutline: fm.outline === true ? headings.length > 0 : fm.outline === false ? false : headings.filter((h) => h.depth === 2).length >= 3,
    });
  }

  posts.sort((a, b) => b.date - a.date || a.title.localeCompare(b.title));
  for (const p of posts) {
    p.authors.forEach((a) => a.posts.push(p));
    if (p.category) p.category.posts.push(p);
    p.tags.forEach((t) => t.posts.push(p));
  }

  return { site, posts, authors, categories, tags };
}

// ── Pages ───────────────────────────────────────────────────────────────────

function related(post, posts) {
  const tagKeys = new Set(post.tags.map((t) => t.key));
  return posts
    .filter((p) => p !== post)
    .map((p) => ({ p, score: p.tags.filter((t) => tagKeys.has(t.key)).length * 2 + (p.category && p.category === post.category ? 1 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.date - a.p.date)
    .slice(0, 3)
    .map((x) => x.p);
}

function rss(site, posts) {
  const abs = (html) => html.replace(/(src|href)="\/(?!\/)/g, `$1="${site.url}/`);
  const cdata = (s) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
  const items = posts.slice(0, 30).map((p) => `  <item>
    <title>${escapeHtml(p.title)}</title>
    <link>${site.url}${p.url}</link>
    <guid isPermaLink="true">${site.url}${p.url}</guid>
    <pubDate>${p.date.toUTCString()}</pubDate>
    ${p.authors.map((a) => `<dc:creator>${escapeHtml(a.name)}</dc:creator>`).join('')}
    ${p.category ? `<category>${escapeHtml(p.category.name)}</category>` : ''}${p.tags.map((t) => `<category>${escapeHtml(t.name)}</category>`).join('')}
    <description>${escapeHtml(p.excerpt)}</description>
    <content:encoded>${cdata((p.cover ? `<p><img src="${site.url}${p.cover}" alt="${escapeHtml(p.cover_alt)}"></p>` : '') + abs(p.html))}</content:encoded>
  </item>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>${escapeHtml(site.title)}</title>
  <link>${site.url}/</link>
  <description>${escapeHtml(site.tagline)}</description>
  <language>${site.language}</language>
  <atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml"/>
  ${posts[0] ? `<lastBuildDate>${posts[0].date.toUTCString()}</lastBuildDate>` : ''}
${items.join('\n')}
</channel>
</rss>
`;
}

function build() {
  const started = Date.now();
  const { site, posts, authors, categories, tags } = load();

  if (problems.length) {
    console.error(`\nThe blog didn't build — please fix:\n${problems.join('\n')}\n`);
    process.exitCode = 1;
    return false;
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  copyDir(path.join(ROOT, 'public'), OUT);
  copyDir(path.join(__dirname, 'assets'), path.join(OUT, 'assets'));

  // Versioned asset links, so browsers fetch new CSS/JS after each change.
  const assets = {};
  for (const f of fs.readdirSync(path.join(__dirname, 'assets'))) {
    assets[path.basename(f, path.extname(f))] = hash(fs.readFileSync(path.join(__dirname, 'assets', f)));
  }
  const ctx = { site, assets, dev: DEV, postCount: posts.length };

  const usedCategories = Object.values(categories).filter((c) => c.posts.length);
  const usedTags = Object.values(tags).sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name));
  const usedAuthors = Object.values(authors).filter((a) => a.posts.length);
  const years = [...new Set(posts.map((p) => p.year))].map((year) => ({ year, posts: posts.filter((p) => p.year === year) }));

  // Featured: posts marked `featured: true`, newest first. If none, the newest post leads.
  const featured = posts.filter((p) => p.featured).slice(0, 3);
  if (!featured.length && posts[0]) featured.push(posts[0]);
  const latest = posts.filter((p) => !featured.includes(p)).slice(0, site.posts_on_home || 9);

  write('index.html', T.home(ctx, { featured, latest, categories: usedCategories, years }));

  posts.forEach((p, i) => {
    write(`${p.year}/${p.slug}/index.html`, T.post(ctx, p, { prev: posts[i + 1], next: posts[i - 1], related: related(p, posts) }));
    write(`${p.year}/${p.slug}.md`, p.markdown);
  });

  for (const y of years) {
    write(`${y.year}/index.html`, T.postList(ctx, { path: `/${y.year}/`, nav: 'archive', kicker: 'Year', title: String(y.year), posts: y.posts }));
  }
  for (const c of usedCategories) {
    write(`category/${c.key}/index.html`, T.postList(ctx, { path: c.url_path, nav: 'categories', kicker: 'Category', title: c.name, description: c.description, posts: c.posts }));
  }
  for (const t of usedTags) {
    write(`tag/${t.key}/index.html`, T.postList(ctx, { path: t.url_path, nav: 'tags', kicker: 'Tag', title: `#${t.name}`, posts: t.posts }));
  }
  for (const a of usedAuthors) write(`author/${a.key}/index.html`, T.authorPage(ctx, a));

  write('archive/index.html', T.archive(ctx, years));
  write('categories/index.html', T.categoriesIndex(ctx, usedCategories));
  write('tags/index.html', T.tagsIndex(ctx, usedTags));
  write('authors/index.html', T.authorsIndex(ctx, usedAuthors));
  write('search/index.html', T.searchPage(ctx));
  write('admin/index.html', T.admin(ctx));
  write('404.html', T.notFound(ctx));

  write('search.json', JSON.stringify(posts.map((p) => ({
    u: p.url,
    t: p.title,
    d: p.excerpt,
    a: p.authors.map((a) => a.name).join(', '),
    c: p.category ? p.category.name : '',
    g: p.tags.map((t) => t.name),
    y: T.fmtDate(p.date),
    b: p.text.slice(0, 6000),
  }))));

  write('rss.xml', rss(site, posts));

  const urls = ['/', '/archive/', '/categories/', '/tags/', '/authors/', ...posts.map((p) => p.url), ...years.map((y) => `/${y.year}/`), ...usedCategories.map((c) => c.url_path), ...usedTags.map((t) => t.url_path), ...usedAuthors.map((a) => a.url_path)];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${site.url}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nDisallow: /admin/\nSitemap: ${site.url}/sitemap.xml\n`);

  // Cloudflare Pages reads this file for response headers.
  write('_headers', `/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/admin/*\n  X-Robots-Tag: noindex\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);

  console.log(`Built ${posts.length} posts into dist/ in ${Date.now() - started}ms${SHOW_DRAFTS ? ' (drafts included)' : ''}.`);
  return true;
}

if (require.main === module) build();
module.exports = { build };
