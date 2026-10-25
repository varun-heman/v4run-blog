// Threaded comments under each post. Talks to /api/comments (functions/api/comments.js).
// New comments wait for approval in /admin/ before anyone else sees them.
(function () {
  'use strict';
  var section = document.querySelector('[data-comments]');
  if (!section) return;
  var root = section.querySelector('[data-comments-root]');
  var countEl = section.querySelector('[data-comments-count]');
  var post = section.dataset.post;
  var siteKey = section.dataset.turnstile;
  var API = '/api/comments';
  var MAX_INDENT = 4; // deeper replies stop indenting so text never gets squeezed

  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };

  // Plain text in, safe HTML out: paragraphs, line breaks and clickable links.
  function format(text) {
    return esc(text).split(/\n{2,}/).map(function (para) {
      return '<p>' + para.replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" rel="nofollow ugc noopener">$1</a>') + '</p>';
    }).join('');
  }

  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    var units = [[31536000, 'year'], [2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
    for (var i = 0; i < units.length; i++) {
      var n = Math.floor(s / units[i][0]);
      if (n >= 1) return n + ' ' + units[i][1] + (n > 1 ? 's' : '') + ' ago';
    }
  }

  function tree(list) {
    var byId = {}, top = [];
    list.forEach(function (c) { c.replies = []; byId[c.id] = c; });
    list.forEach(function (c) { (c.parent_id && byId[c.parent_id] ? byId[c.parent_id].replies : top).push(c); });
    return top;
  }

  function renderList(items, depth) {
    if (!items.length) return '';
    return '<ol class="c-list"' + (depth >= MAX_INDENT ? ' style="padding-left:0;border-left:0"' : '') + '>' + items.map(function (c) {
      var n = countAll(c.replies);
      return '<li class="c-item" id="comment-' + c.id + '" data-id="' + c.id + '">' +
        '<div class="c-head"><span class="c-name">' + esc(c.name) + '</span>' +
        (c.is_author ? '<span class="c-badge">Author</span>' : '') +
        '<a class="c-time" href="#comment-' + c.id + '" title="' + esc(new Date(c.created_at).toLocaleString()) + '">' + ago(c.created_at) + '</a></div>' +
        '<div class="c-body">' + format(c.body) + '</div>' +
        '<div class="c-tools"><button type="button" data-reply>Reply</button>' +
        (n ? '<button type="button" data-collapse aria-expanded="true">Hide ' + n + (n > 1 ? ' replies' : ' reply') + '</button>' : '') + '</div>' +
        renderList(c.replies, depth + 1) +
        '</li>';
    }).join('') + '</ol>';
  }
  function countAll(items) { return items.reduce(function (n, c) { return n + 1 + countAll(c.replies); }, 0); }

  function formHtml(parentId) {
    return '<form class="c-form" data-parent="' + (parentId || '') + '" novalidate>' +
      '<label><span>' + (parentId ? 'Your reply' : 'Add a comment') + '</span><textarea name="body" required maxlength="5000" placeholder="' + (parentId ? 'Write a reply…' : 'What do you think?') + '"></textarea></label>' +
      '<div class="c-form-row">' +
        '<label><span>Name</span><input type="text" name="name" required maxlength="60" autocomplete="name" value="' + esc(store.get('c-name')) + '"></label>' +
        '<label><span>Email <span class="muted">(optional, never shown)</span></span><input type="email" name="email" maxlength="254" autocomplete="email" value="' + esc(store.get('c-email')) + '"></label>' +
      '</div>' +
      '<label class="c-check"><input type="checkbox" name="notify"> Email me when someone replies</label>' +
      '<label class="c-hp" aria-hidden="true">Leave this empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label>' +
      (siteKey ? '<div class="c-turnstile"></div>' : '') +
      '<div class="c-actions"><p class="c-note">Comments appear after a quick review.</p>' +
        '<span>' + (parentId ? '<button type="button" class="btn btn-ghost btn-sm" data-cancel>Cancel</button> ' : '') +
        '<button type="submit" class="btn btn-sm">' + (parentId ? 'Post reply' : 'Post comment') + '</button></span></div>' +
      '<p class="c-status" role="status" aria-live="polite"></p>' +
      '</form>';
  }

  // Cloudflare Turnstile (spam check), loaded only if a site key is set in site.yml.
  var turnstileReady = null;
  function withTurnstile(form) {
    var box = form.querySelector('.c-turnstile');
    if (!box) return;
    if (!turnstileReady) {
      turnstileReady = new Promise(function (resolve) {
        window.__onTurnstile = resolve;
        var s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__onTurnstile';
        s.async = true;
        document.head.appendChild(s);
      });
    }
    turnstileReady.then(function () { form._ts = window.turnstile.render(box, { sitekey: siteKey, appearance: 'interaction-only' }); });
  }

  function bindForm(form) {
    withTurnstile(form);
    var status = form.querySelector('.c-status');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var body = f.body.value.trim(), name = f.name.value.trim(), email = f.email.value.trim();
      status.classList.remove('is-error');
      if (body.length < 2) return fail('Please write a comment first.', f.body);
      if (!name) return fail('Please add your name.', f.name);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('That email doesn’t look right.', f.email);
      if (f.notify.checked && !email) return fail('Add your email to get reply notifications.', f.email);

      store.set('c-name', name);
      store.set('c-email', email);
      var btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      status.textContent = 'Sending…';

      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post: post,
          parent_id: form.dataset.parent ? Number(form.dataset.parent) : null,
          name: name, email: email, notify: f.notify.checked, body: body,
          website: f.website.value,
          turnstile: form._ts != null && window.turnstile ? window.turnstile.getResponse(form._ts) : '',
        }),
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong.'); return j; }); })
        .then(function (res) {
          if (res.status === 'approved') { load(); return; }
          form.innerHTML = '<p class="c-status">Thanks, ' + esc(name) + '! Your ' + (form.dataset.parent ? 'reply' : 'comment') + ' will appear once it’s approved.</p>';
        })
        .catch(function (err) {
          btn.disabled = false;
          if (form._ts != null && window.turnstile) window.turnstile.reset(form._ts);
          fail(err.message);
        });

      function fail(msg, field) { status.textContent = msg; status.classList.add('is-error'); if (field) field.focus(); }
    });
  }

  function load() {
    fetch(API + '?post=' + encodeURIComponent(post))
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (data) {
        var list = data.comments || [];
        countEl.textContent = list.length ? '(' + list.length + ')' : '';
        root.innerHTML = formHtml(null) +
          (list.length ? renderList(tree(list), 0) : '<p class="c-empty">No comments yet. Start the conversation.</p>');
        bindForm(root.querySelector('.c-form'));
        if (location.hash.indexOf('#comment-') === 0) {
          var target = document.querySelector(location.hash);
          if (target) target.scrollIntoView();
        }
      })
      .catch(function () {
        root.innerHTML = '<p class="c-empty">Comments couldn’t load right now. Try refreshing in a moment.</p>';
      });
  }

  root.addEventListener('click', function (e) {
    var item = e.target.closest('.c-item');
    if (e.target.matches('[data-reply]')) {
      var open = item.querySelector(':scope > .c-form');
      if (open) { open.querySelector('textarea').focus(); return; }
      e.target.closest('.c-tools').insertAdjacentHTML('afterend', formHtml(item.dataset.id));
      var form = item.querySelector(':scope > .c-form');
      bindForm(form);
      form.querySelector('textarea').focus();
    } else if (e.target.matches('[data-cancel]')) {
      e.target.closest('.c-form').remove();
    } else if (e.target.matches('[data-collapse]')) {
      var collapsed = item.classList.toggle('is-collapsed');
      e.target.setAttribute('aria-expanded', String(!collapsed));
      e.target.textContent = e.target.textContent.replace(collapsed ? 'Hide' : 'Show', collapsed ? 'Show' : 'Hide');
    }
  });

  // Load once the page has settled, or sooner if the reader heads for the comments.
  var started = false;
  function start() { if (!started) { started = true; load(); } }
  if (location.hash.indexOf('#comment') === 0) start();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries, io) {
      if (entries[0].isIntersecting) { io.disconnect(); start(); }
    }, { rootMargin: '600px' }).observe(section);
  }
  addEventListener('load', function () { setTimeout(start, 1200); });
})();
