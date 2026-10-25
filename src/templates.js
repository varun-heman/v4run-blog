// HTML for every kind of page. Each function returns a string.
// `layout()` wraps a page body in the shared <head>, header and footer.

const { escapeHtml: e } = require('./markdown');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const isoDate = (d) => d.toISOString().slice(0, 10);

const FONTS =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=Space+Mono:wght@400;700&display=swap';

// ── Shared page shell ───────────────────────────────────────────────────────

function layout(ctx, page) {
  const { site, assets, dev } = ctx;
  const title = page.title ? `${page.title} — ${site.title}` : `${site.title} — ${site.tagline}`;
  const description = page.description || site.tagline;
  const canonical = site.url + page.path;
  const image = page.image ? absolute(site, page.image) : null;

  return `<!doctype html>
<html lang="${e(site.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(description)}">
<link rel="canonical" href="${e(canonical)}">
${page.noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:site_name" content="${e(site.title)}">
<meta property="og:type" content="${page.type === 'article' ? 'article' : 'website'}">
<meta property="og:title" content="${e(page.title || site.title)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${e(canonical)}">
${image ? `<meta property="og:image" content="${e(image)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<link rel="alternate" type="application/rss+xml" title="${e(site.title)}" href="/rss.xml">
<link rel="icon" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#0b0c0b">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/assets/style.css?v=${assets.style}">
<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(_){}</script>
${page.jsonLd ? `<script type="application/ld+json">${JSON.stringify(page.jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
${page.head || ''}
</head>
<body class="${page.bodyClass || ''}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="wordmark" href="/" aria-label="${e(site.title)} — home"><span class="wordmark-text" data-text="${e(site.title)}">${e(site.title)}</span></a>
    <nav class="nav" aria-label="Main">
      <a href="/archive/"${page.nav === 'archive' ? ' aria-current="page"' : ''}>Archive</a>
      <a href="/categories/"${page.nav === 'categories' ? ' aria-current="page"' : ''}>Categories</a>
      <a href="/tags/"${page.nav === 'tags' ? ' aria-current="page"' : ''}>Tags</a>
      <button class="search-btn" type="button" data-search-open aria-label="Search">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <span class="search-btn-label">Search</span><kbd>/</kbd>
      </button>
      <button class="theme-btn" type="button" data-theme-toggle aria-label="Switch light or dark theme">
        <svg class="i-sun" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g></svg>
        <svg class="i-moon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor"/></svg>
      </button>
      <a class="nav-home" href="${e(site.main_site)}">v4.run <span aria-hidden="true">↗</span></a>
    </nav>
  </div>
</header>

<main id="main">
${page.body}
</main>

<footer class="site-footer">
  <div class="wrap footer-inner">
    <p class="footer-title">${e(site.title)}</p>
    <p class="footer-links">
      <a href="/archive/">Archive</a>
      <a href="/authors/">Authors</a>
      <a href="/rss.xml">RSS</a>
      <a href="${e(site.main_site)}">v4.run</a>
    </p>
    <p class="footer-note">Written in markdown. Built without a framework. <span class="heart" aria-hidden="true">♥</span></p>
  </div>
</footer>

<div class="search" data-search hidden>
  <div class="search-backdrop" data-search-close></div>
  <div class="search-panel" role="dialog" aria-modal="true" aria-label="Search posts">
    <div class="search-field">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <input type="search" placeholder="Search posts, tags, authors…" autocomplete="off" spellcheck="false" data-search-input aria-label="Search">
      <button type="button" class="search-esc" data-search-close>esc</button>
    </div>
    <ul class="search-results" data-search-results role="listbox"></ul>
    <p class="search-hint"><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>↵</kbd> to open</p>
  </div>
</div>

<script src="/assets/app.js?v=${assets.app}" defer></script>
${page.scripts || ''}
${dev ? '<script>new EventSource("/__reload").onmessage=function(){location.reload()}</script>' : ''}
</body>
</html>
`;
}

const absolute = (site, url) => (/^https?:/.test(url) ? url : site.url + url);

// ── Small building blocks ───────────────────────────────────────────────────

// A generated dot-sphere picture, used when a post has no cover photo.
// Same post → same picture, every build.
function artwork(seed, label) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rand = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
  const tiltX = rand() * Math.PI, tiltY = rand() * Math.PI;
  const hue = Math.floor(rand() * 3);
  const N = 170;
  let dots = '';
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    let x = Math.cos(th) * r, z = Math.sin(th) * r, yy = y;
    [yy, z] = [yy * Math.cos(tiltX) - z * Math.sin(tiltX), yy * Math.sin(tiltX) + z * Math.cos(tiltX)];
    [x, z] = [x * Math.cos(tiltY) + z * Math.sin(tiltY), -x * Math.sin(tiltY) + z * Math.cos(tiltY)];
    const depth = (z + 1) / 2;
    dots += `<circle cx="${(200 + x * 92).toFixed(1)}" cy="${(112 + yy * 92).toFixed(1)}" r="${(0.6 + depth * 2.1).toFixed(2)}" opacity="${(0.15 + depth * 0.85).toFixed(2)}"/>`;
  }
  return `<svg class="art art-${hue}" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${e(label)}"><rect width="400" height="225" class="art-bg"/><g class="art-dots">${dots}</g></svg>`;
}

function media(post, cls = '') {
  if (post.cover) {
    return `<img class="${cls}" src="${e(post.cover)}" alt="${e(post.cover_alt || '')}" loading="lazy" decoding="async">`;
  }
  return artwork(post.slug, post.title);
}

const authorNames = (post) => post.authors.map((a) => e(a.name)).join(' &amp; ');

function authorLinks(post) {
  return post.authors.map((a) => `<a href="${a.url_path}">${e(a.name)}</a>`).join(' <span class="amp">&amp;</span> ');
}

function avatarStack(post) {
  return `<span class="avatars">${post.authors.map((a) => avatar(a, 'sm')).join('')}</span>`;
}

function avatar(a, size) {
  return a.avatar
    ? `<img class="avatar avatar-${size}" src="${e(a.avatar)}" alt="" loading="lazy">`
    : `<span class="avatar avatar-${size} avatar-initials" aria-hidden="true">${e(a.initials)}</span>`;
}

function categoryChip(post) {
  return post.category ? `<a class="chip chip-cat" href="${post.category.url_path}">${e(post.category.name)}</a>` : '';
}

function card(post, variant = '') {
  return `<article class="card ${variant ? `card-${variant}` : ''}">
  <div class="card-media">${media(post)}</div>
  <div class="card-body">
    <p class="kicker">${categoryChip(post)}<span>${post.readingTime} min read</span>${post.draft ? '<span class="badge-draft">Draft</span>' : ''}</p>
    <h3 class="card-title"><a class="card-link" href="${post.url}">${e(post.title)}</a></h3>
    <p class="card-excerpt">${e(post.excerpt)}</p>
    <p class="card-meta">${avatarStack(post)}<span>${authorNames(post)}</span><span class="dot">·</span><time datetime="${isoDate(post.date)}">${fmtDate(post.date)}</time></p>
  </div>
</article>`;
}

const grid = (posts) => `<div class="grid">${posts.map((p) => card(p)).join('\n')}</div>`;

function listHeader({ kicker, title, description, count, extra = '' }) {
  return `<header class="list-header wrap">
  <p class="eyebrow">${e(kicker)}</p>
  <h1>${e(title)}</h1>
  ${description ? `<p class="list-desc">${e(description)}</p>` : ''}
  ${extra}
  <p class="list-count">${count} ${count === 1 ? 'post' : 'posts'}</p>
</header>`;
}

// ── Pages ───────────────────────────────────────────────────────────────────

function home(ctx, { featured, latest, categories, years }) {
  const { site } = ctx;
  const [lead, ...rest] = featured;
  const featuredHtml = lead
    ? `<section class="featured wrap" aria-labelledby="featured-h">
  <h2 class="section-title" id="featured-h">Featured</h2>
  <div class="featured-grid">
    ${card(lead, 'lead')}
    ${rest.length ? `<div class="featured-side">${rest.slice(0, 2).map((p) => card(p, 'side')).join('\n')}</div>` : ''}
  </div>
</section>`
    : '';

  const body = `
<section class="hero">
  <canvas class="hero-sphere" data-sphere aria-hidden="true"></canvas>
  <div class="wrap hero-inner">
    <p class="eyebrow">blog.v4.run</p>
    <h1 class="hero-title glitch" data-text="${e(site.title)}">${e(site.title)}</h1>
    <p class="hero-tagline">${e(site.tagline)}</p>
    <p class="hero-actions">
      <button class="btn" type="button" data-search-open>Search the blog <kbd>/</kbd></button>
      <a class="btn btn-ghost" href="/rss.xml">RSS feed</a>
    </p>
  </div>
</section>

${featuredHtml}

<section class="latest wrap" aria-labelledby="latest-h">
  <div class="section-head">
    <h2 class="section-title" id="latest-h">Latest</h2>
    <a class="more" href="/archive/">All posts →</a>
  </div>
  ${grid(latest)}
</section>

<section class="browse wrap" aria-labelledby="browse-h">
  <h2 class="section-title" id="browse-h">Browse by category</h2>
  <div class="cat-tiles">
    ${categories.map((c) => `<a class="cat-tile" href="${c.url_path}"><span class="cat-tile-name">${e(c.name)}</span><span class="cat-tile-desc">${e(c.description || '')}</span><span class="cat-tile-count">${c.posts.length} ${c.posts.length === 1 ? 'post' : 'posts'}</span></a>`).join('\n')}
  </div>
  <p class="year-links">By year: ${years.map((y) => `<a href="/${y.year}/">${y.year}</a>`).join(' ')}</p>
</section>`;

  return layout(ctx, {
    path: '/',
    body,
    bodyClass: 'is-home',
    scripts: `<script src="/assets/sphere.js?v=${ctx.assets.sphere}" defer></script>`,
    jsonLd: { '@context': 'https://schema.org', '@type': 'Blog', name: site.title, description: site.tagline, url: site.url },
  });
}

function post(ctx, p, { prev, next, related }) {
  const { site } = ctx;
  const outline = p.showOutline
    ? `<nav class="outline" aria-label="On this page" data-outline>
  <details class="outline-box" open>
    <summary>On this page</summary>
    <ol>
      ${p.headings.map((h) => `<li class="lvl-${h.depth}"><a href="#${h.id}">${e(h.text)}</a></li>`).join('\n      ')}
    </ol>
  </details>
</nav>`
    : '';

  const cover = p.cover
    ? `<figure class="post-cover"><img src="${e(p.cover)}" alt="${e(p.cover_alt || '')}" fetchpriority="high">${p.cover_caption ? `<figcaption>${e(p.cover_caption)}</figcaption>` : ''}</figure>`
    : `<div class="post-cover post-cover-art">${artwork(p.slug, p.title)}</div>`;

  const tags = p.tags.length
    ? `<ul class="tags" aria-label="Tags">${p.tags.map((t) => `<li><a class="chip" href="${t.url_path}">#${e(t.name)}</a></li>`).join('')}</ul>`
    : '';

  const bios = p.authors
    .map((a) => `<div class="bio">${avatar(a, 'lg')}<div><p class="bio-name"><a href="${a.url_path}">${e(a.name)}</a></p>${a.bio ? `<p class="bio-text">${e(a.bio)}</p>` : ''}</div></div>`)
    .join('\n');

  const pager = prev || next
    ? `<nav class="pager" aria-label="More posts">
  ${prev ? `<a class="pager-prev" href="${prev.url}"><span>← Older</span>${e(prev.title)}</a>` : '<span></span>'}
  ${next ? `<a class="pager-next" href="${next.url}"><span>Newer →</span>${e(next.title)}</a>` : '<span></span>'}
</nav>`
    : '';

  const relatedHtml = related.length
    ? `<section class="related wrap" aria-labelledby="related-h"><h2 class="section-title" id="related-h">Keep reading</h2>${grid(related)}</section>`
    : '';

  const comments = site.comments.enabled && p.comments !== false
    ? `<section class="comments" id="comments" aria-labelledby="comments-h" data-comments data-post="${p.url}" data-turnstile="${e(site.comments.turnstile_site_key || '')}">
  <h2 id="comments-h">Comments <span class="comments-count" data-comments-count></span></h2>
  <div data-comments-root><p class="muted">Loading comments…</p></div>
</section>`
    : '';

  const body = `
<div class="progress" aria-hidden="true"><span data-progress></span></div>
<article class="post${p.showOutline ? ' has-outline' : ''}">
  <header class="post-header wrap-text">
    <p class="kicker">${categoryChip(p)}<span>${p.readingTime} min read</span>${p.draft ? '<span class="badge-draft">Draft — only visible while previewing</span>' : ''}</p>
    <h1 class="post-title">${e(p.title)}</h1>
    ${p.description ? `<p class="post-dek">${e(p.description)}</p>` : ''}
    <div class="post-meta">
      ${avatarStack(p)}
      <span>${authorLinks(p)}</span>
      <span class="dot">·</span>
      <time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time>
      ${p.updated ? `<span class="dot">·</span><span>Updated <time datetime="${isoDate(p.updated)}">${fmtDate(p.updated)}</time></span>` : ''}
    </div>
  </header>

  ${cover}

  <div class="post-layout">
    ${outline}
    <div class="prose" data-prose>
${p.html}
    </div>
  </div>

  <footer class="post-footer wrap-text">
    ${tags}
    <div class="share">
      <button class="btn btn-ghost btn-sm" type="button" data-copy-link>Copy link</button>
      <a class="btn btn-ghost btn-sm" href="${p.url.replace(/\/$/, '')}.md">View as markdown</a>
    </div>
    <div class="bios">${bios}</div>
    ${pager}
  </footer>
</article>

${comments ? `<div class="wrap-text">${comments}</div>` : ''}
${relatedHtml}`;

  return layout(ctx, {
    path: p.url,
    title: p.title,
    description: p.excerpt,
    image: p.cover,
    type: 'article',
    body,
    bodyClass: 'is-post',
    head: `<meta property="article:published_time" content="${p.date.toISOString()}">${p.tags.map((t) => `<meta property="article:tag" content="${e(t.name)}">`).join('')}`,
    scripts: comments ? `<script src="/assets/comments.js?v=${ctx.assets.comments}" defer></script>` : '',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: p.title,
      description: p.excerpt,
      datePublished: p.date.toISOString(),
      dateModified: (p.updated || p.date).toISOString(),
      author: p.authors.map((a) => ({ '@type': 'Person', name: a.name, url: a.url || site.url + a.url_path })),
      image: p.cover ? absolute(site, p.cover) : undefined,
      mainEntityOfPage: site.url + p.url,
      keywords: p.tags.map((t) => t.name).join(', ') || undefined,
    },
  });
}

function postList(ctx, { path, nav, kicker, title, description, posts, extra }) {
  const body = `${listHeader({ kicker, title, description, count: posts.length, extra })}
<section class="wrap list-body">${grid(posts)}</section>`;
  return layout(ctx, { path, nav, title, description: description || `${kicker}: ${title}`, body });
}

function archive(ctx, years) {
  const total = years.reduce((n, y) => n + y.posts.length, 0);
  const body = `${listHeader({ kicker: 'Archive', title: 'Everything, newest first', count: total })}
<section class="wrap archive">
  ${years
    .map(
      (y) => `<div class="archive-year">
    <h2><a href="/${y.year}/">${y.year}</a></h2>
    <ol>
      ${y.posts
        .map(
          (p) => `<li><time datetime="${isoDate(p.date)}">${fmtDate(p.date).replace(/ \d{4}$/, '')}</time><a href="${p.url}">${e(p.title)}</a>${p.category ? `<span class="archive-cat">${e(p.category.name)}</span>` : ''}</li>`
        )
        .join('\n      ')}
    </ol>
  </div>`
    )
    .join('\n')}
</section>`;
  return layout(ctx, { path: '/archive/', nav: 'archive', title: 'Archive', description: 'Every post, grouped by year.', body });
}

function categoriesIndex(ctx, categories) {
  const body = `${listHeader({ kicker: 'Browse', title: 'Categories', count: categories.reduce((n, c) => n + c.posts.length, 0) })}
<section class="wrap"><div class="cat-tiles cat-tiles-lg">
  ${categories.map((c) => `<a class="cat-tile" href="${c.url_path}"><span class="cat-tile-name">${e(c.name)}</span><span class="cat-tile-desc">${e(c.description || '')}</span><span class="cat-tile-count">${c.posts.length} ${c.posts.length === 1 ? 'post' : 'posts'}</span></a>`).join('\n')}
</div></section>`;
  return layout(ctx, { path: '/categories/', nav: 'categories', title: 'Categories', body });
}

function tagsIndex(ctx, tags) {
  const max = Math.max(1, ...tags.map((t) => t.posts.length));
  const body = `${listHeader({ kicker: 'Browse', title: 'Tags', count: new Set(tags.flatMap((t) => t.posts)).size })}
<section class="wrap"><ul class="tag-cloud">
  ${tags.map((t) => `<li><a class="chip" style="--w:${(0.4 + (0.6 * t.posts.length) / max).toFixed(2)}" href="${t.url_path}">#${e(t.name)} <span>${t.posts.length}</span></a></li>`).join('\n')}
</ul></section>`;
  return layout(ctx, { path: '/tags/', nav: 'tags', title: 'Tags', body });
}

function authorsIndex(ctx, authors) {
  const body = `${listHeader({ kicker: 'People', title: 'Authors', count: new Set(authors.flatMap((a) => a.posts)).size })}
<section class="wrap"><div class="bios bios-grid">
  ${authors.map((a) => `<a class="bio bio-card" href="${a.url_path}">${avatar(a, 'lg')}<div><p class="bio-name">${e(a.name)}</p>${a.bio ? `<p class="bio-text">${e(a.bio)}</p>` : ''}<p class="list-count">${a.posts.length} ${a.posts.length === 1 ? 'post' : 'posts'}</p></div></a>`).join('\n')}
</div></section>`;
  return layout(ctx, { path: '/authors/', title: 'Authors', body });
}

function authorPage(ctx, a) {
  const extra = `<div class="author-head">${avatar(a, 'xl')}${a.bio ? `<p class="list-desc">${e(a.bio)}</p>` : ''}${a.url ? `<p><a class="ext" href="${e(a.url)}">${e(a.url.replace(/^https?:\/\//, ''))}</a></p>` : ''}</div>`;
  return postList(ctx, { path: a.url_path, kicker: 'Author', title: a.name, posts: a.posts, extra, description: a.bio });
}

function searchPage(ctx) {
  const body = `${listHeader({ kicker: 'Search', title: 'Find a post', count: ctx.postCount })}
<section class="wrap-text">
  <form class="search-page-form" role="search" action="/search/" data-search-page>
    <input type="search" name="q" placeholder="Try “justice” or “roads”…" aria-label="Search posts" autofocus>
  </form>
  <ul class="search-results search-results-page" data-search-page-results></ul>
</section>`;
  return layout(ctx, { path: '/search/', title: 'Search', body, noindex: true });
}

function notFound(ctx) {
  const body = `<section class="wrap-text not-found">
  <p class="eyebrow">404</p>
  <h1 class="glitch" data-text="Nothing here.">Nothing here.</h1>
  <p>This page doesn't exist — maybe it moved, or the link has a typo.</p>
  <p class="hero-actions"><a class="btn" href="/">Go home</a><button class="btn btn-ghost" type="button" data-search-open>Search instead</button></p>
</section>`;
  return layout(ctx, { path: '/404', title: 'Not found', body, noindex: true });
}

function admin(ctx) {
  const body = `<section class="wrap-text admin" data-admin>
  <p class="eyebrow">Moderation</p>
  <h1>Comments</h1>
  <form class="admin-login" data-admin-login>
    <label>Admin password <input type="password" name="token" autocomplete="current-password" required></label>
    <button class="btn" type="submit">Open</button>
  </form>
  <div data-admin-body hidden>
    <div class="admin-tabs" role="tablist">
      <button type="button" role="tab" data-status="pending" aria-selected="true">Waiting for approval</button>
      <button type="button" role="tab" data-status="approved" aria-selected="false">Published</button>
    </div>
    <div data-admin-list></div>
  </div>
</section>`;
  return layout(ctx, {
    path: '/admin/',
    title: 'Moderate comments',
    body,
    noindex: true,
    scripts: `<script src="/assets/admin.js?v=${ctx.assets.admin}" defer></script>`,
  });
}

module.exports = { layout, home, post, postList, archive, categoriesIndex, tagsIndex, authorsIndex, authorPage, searchPage, notFound, admin, fmtDate, isoDate };
