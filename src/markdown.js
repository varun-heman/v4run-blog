// Turns a post's markdown into HTML, and collects its headings for the outline.
//
// On top of standard markdown (via `marked`) this adds:
//   - an id + "#" anchor on every heading, so sections can be linked to
//   - a picture on its own line becomes a <figure>; its "title" becomes the caption:
//       ![alt text](/images/2026/photo.jpg "Caption shown under the photo")
//   - GitHub-style callouts:  > [!NOTE]  > [!TIP]  > [!WARNING]
//   - tables scroll sideways on small screens instead of breaking the layout

const { Marked, Renderer } = require('marked');

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z0-9#]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const stripTags = (html) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const CALLOUTS = { NOTE: 'Note', TIP: 'Tip', WARNING: 'Warning', IMPORTANT: 'Important' };

function render(markdown, { siteUrl }) {
  const headings = [];
  const usedIds = new Set();
  const siteHost = new URL(siteUrl).host;

  const renderer = {
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens);
      let id = slugify(stripTags(inner)) || 'section';
      for (let n = 2; usedIds.has(id); n++) id = `${slugify(stripTags(inner))}-${n}`;
      usedIds.add(id);
      if (depth === 2 || depth === 3) headings.push({ depth, id, text: stripTags(inner) });
      return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-label="Link to this section">#</a>${inner}</h${depth}>\n`;
    },

    image({ href, title, text }) {
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}" loading="lazy" decoding="async">`;
    },

    paragraph({ tokens }) {
      // A picture on its own line → a full figure with an optional caption.
      if (tokens.length === 1 && tokens[0].type === 'image') {
        const { href, title, text } = tokens[0];
        const caption = title ? `<figcaption>${escapeHtml(title)}</figcaption>` : '';
        return `<figure><img src="${escapeHtml(href)}" alt="${escapeHtml(text)}" loading="lazy" decoding="async">${caption}</figure>\n`;
      }
      return `<p>${this.parser.parseInline(tokens)}</p>\n`;
    },

    link({ href, title, tokens }) {
      const inner = this.parser.parseInline(tokens);
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      let external = false;
      try { external = /^https?:/.test(href) && new URL(href).host !== siteHost; } catch {}
      return external
        ? `<a href="${escapeHtml(href)}"${t} rel="noopener" class="ext">${inner}</a>`
        : `<a href="${escapeHtml(href)}"${t}>${inner}</a>`;
    },

    code({ text, lang }) {
      const language = (lang || '').trim().split(/\s+/)[0];
      const label = language ? ` data-lang="${escapeHtml(language)}"` : '';
      return `<pre class="code"${label}><code>${escapeHtml(text)}</code></pre>\n`;
    },

    table(token) {
      return `<div class="table-wrap">${Renderer.prototype.table.call(this, token)}</div>\n`;
    },

    blockquote({ tokens }) {
      const body = this.parser.parse(tokens);
      const m = body.match(/^<p>\[!(NOTE|TIP|WARNING|IMPORTANT)\]\s*/);
      if (!m) return `<blockquote>\n${body}</blockquote>\n`;
      const kind = m[1];
      const rest = body.slice(m[0].length).replace(/^<\/p>\s*/, '');
      const content = rest.startsWith('<') ? rest : `<p>${rest}`;
      return `<aside class="callout callout-${kind.toLowerCase()}"><p class="callout-title">${CALLOUTS[kind]}</p>${content}</aside>\n`;
    },
  };

  const marked = new Marked({ gfm: true, renderer });
  const html = marked.parse(markdown);
  return { html, headings };
}

module.exports = { render, slugify, escapeHtml, stripTags };
