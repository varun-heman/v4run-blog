// Runs on every page: theme switch, search, reading progress, outline highlighting,
// copy buttons. No libraries.
(function () {
  'use strict';
  var root = document.documentElement;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  // ── Theme ──────────────────────────────────────────────────────────────
  $$('[data-theme-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var current = root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      var next = current === 'light' ? 'dark' : 'light';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (_) {}
    });
  });

  // ── Search ─────────────────────────────────────────────────────────────
  var index = null;
  function loadIndex() {
    if (!index) index = fetch('/search.json').then(function (r) { return r.json(); });
    return index;
  }
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, ''); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  // Every word must appear somewhere; matches in the title count most.
  function search(posts, query) {
    var words = norm(query).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return posts.map(function (p) {
      var f = { t: norm(p.t), g: norm(p.g.join(' ')), c: norm(p.c), a: norm(p.a), d: norm(p.d), b: norm(p.b) };
      var score = 0;
      for (var i = 0; i < words.length; i++) {
        var w = words[i], s = 0;
        if (f.t.indexOf(w) > -1) s += f.t.split(/\W+/).indexOf(w) > -1 ? 12 : 8;
        if (f.g.indexOf(w) > -1) s += 6;
        if (f.c.indexOf(w) > -1 || f.a.indexOf(w) > -1) s += 4;
        if (f.d.indexOf(w) > -1) s += 3;
        if (f.b.indexOf(w) > -1) s += 1 + Math.min(3, f.b.split(w).length - 2) * 0.3;
        if (!s) return null;
        score += s;
      }
      return { p: p, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; }).slice(0, 12).map(function (x) { return x.p; });
  }

  function snippet(p, query) {
    var words = norm(query).split(/\s+/).filter(Boolean);
    var body = p.b, nb = norm(body), at = -1;
    for (var i = 0; i < words.length && at < 0; i++) at = nb.indexOf(words[i]);
    var text = at < 0 ? p.d : (at > 60 ? '…' : '') + body.slice(Math.max(0, at - 60), at + 120) + '…';
    return highlight(text, words);
  }
  function highlight(text, words) {
    var out = esc(text);
    words.forEach(function (w) {
      if (w.length < 2) return;
      out = out.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>');
    });
    return out;
  }
  function resultHtml(p, query) {
    var words = norm(query).split(/\s+/).filter(Boolean);
    return '<li><a href="' + p.u + '"><span class="sr-title">' + highlight(p.t, words) + '</span>' +
      '<span class="sr-meta">' + esc([p.c, p.y, p.a].filter(Boolean).join(' · ')) + '</span>' +
      '<span class="sr-snippet">' + snippet(p, query) + '</span></a></li>';
  }

  var overlay = $('[data-search]');
  var input = $('[data-search-input]');
  var results = $('[data-search-results]');
  var selected = -1;
  var lastFocus = null;

  function openSearch() {
    if (!overlay) return;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    input.value = '';
    results.innerHTML = '';
    input.focus();
    loadIndex();
  }
  function closeSearch() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  function select(i) {
    var links = $$('a', results);
    if (!links.length) return;
    selected = (i + links.length) % links.length;
    links.forEach(function (a, n) { a.setAttribute('aria-selected', n === selected ? 'true' : 'false'); });
    links[selected].scrollIntoView({ block: 'nearest' });
  }

  $$('[data-search-open]').forEach(function (b) { b.addEventListener('click', openSearch); });
  $$('[data-search-close]').forEach(function (b) { b.addEventListener('click', closeSearch); });

  if (input) {
    input.addEventListener('input', function () {
      var q = input.value;
      loadIndex().then(function (posts) {
        if (q !== input.value) return;
        var found = search(posts, q);
        selected = -1;
        results.innerHTML = !q.trim() ? '' : found.length
          ? found.map(function (p) { return resultHtml(p, q); }).join('')
          : '<li class="search-empty">Nothing matches “' + esc(q) + '”. Try fewer words.</li>';
        if (found.length) select(0);
      });
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); select(selected + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); select(selected - 1); }
      else if (e.key === 'Enter') {
        var a = $$('a', results)[selected];
        if (a) { e.preventDefault(); location.href = a.href; }
        else if (input.value.trim()) location.href = '/search/?q=' + encodeURIComponent(input.value.trim());
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      openSearch();
    } else if (e.key === 'Escape') closeSearch();
  });

  // The /search/ page: same search, shown in the page instead of a pop-up.
  var pageForm = $('[data-search-page]');
  if (pageForm) {
    var pageInput = $('input', pageForm);
    var pageResults = $('[data-search-page-results]');
    var run = function () {
      var q = pageInput.value;
      loadIndex().then(function (posts) {
        var found = search(posts, q);
        pageResults.innerHTML = !q.trim() ? '' : found.length
          ? found.map(function (p) { return resultHtml(p, q); }).join('')
          : '<li class="search-empty">Nothing matches “' + esc(q) + '”.</li>';
      });
      history.replaceState(null, '', q ? '?q=' + encodeURIComponent(q) : location.pathname);
    };
    pageInput.value = new URLSearchParams(location.search).get('q') || '';
    pageInput.addEventListener('input', run);
    pageForm.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    if (pageInput.value) run();
  }

  // ── Reading progress ───────────────────────────────────────────────────
  var bar = $('[data-progress]');
  var prose = $('[data-prose]');
  if (bar && prose) {
    var ticking = false;
    var update = function () {
      var r = prose.getBoundingClientRect();
      var total = r.height - innerHeight * 0.6;
      var done = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
      bar.style.transform = 'scaleX(' + done + ')';
      ticking = false;
    };
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // ── Outline: highlight the section being read ──────────────────────────
  var outline = $('[data-outline]');
  if (outline && prose) {
    var links = $$('a', outline);
    var heads = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
    var details = $('details', outline);
    var wide = matchMedia('(min-width: 1180px)');
    // On narrow screens the outline starts folded so the text comes first.
    if (!wide.matches) details.open = false;
    var active = function () {
      var current = heads[0];
      for (var i = 0; i < heads.length; i++) if (heads[i].getBoundingClientRect().top < 140) current = heads[i];
      links.forEach(function (a) { a.classList.toggle('is-active', current && a.getAttribute('href') === '#' + current.id); });
    };
    addEventListener('scroll', function () { requestAnimationFrame(active); }, { passive: true });
    links.forEach(function (a) { a.addEventListener('click', function () { if (!wide.matches) details.open = false; }); });
    active();
  }

  // ── Copy buttons ───────────────────────────────────────────────────────
  function flash(btn, text) {
    var old = btn.textContent;
    btn.textContent = text;
    setTimeout(function () { btn.textContent = old; }, 1500);
  }
  $$('.prose pre').forEach(function (pre) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'copy-code';
    b.textContent = 'Copy';
    b.addEventListener('click', function () {
      navigator.clipboard.writeText(pre.querySelector('code').innerText).then(function () { flash(b, 'Copied'); });
    });
    pre.appendChild(b);
  });
  $$('[data-copy-link]').forEach(function (b) {
    b.addEventListener('click', function () {
      navigator.clipboard.writeText(location.href.split('#')[0]).then(function () { flash(b, 'Link copied'); });
    });
  });
})();
