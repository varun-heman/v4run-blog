// The moderation page at /admin/. Approve, hide, delete, or reply as the author.
// The password is the ADMIN_TOKEN set in Cloudflare; it's kept only for this browser tab.
(function () {
  'use strict';
  var page = document.querySelector('[data-admin]');
  if (!page) return;
  var login = page.querySelector('[data-admin-login]');
  var bodyEl = page.querySelector('[data-admin-body]');
  var list = page.querySelector('[data-admin-list]');
  var tabs = Array.prototype.slice.call(page.querySelectorAll('[data-status]'));
  var status = 'pending';
  var token = '';
  try { token = sessionStorage.getItem('admin-token') || ''; } catch (_) {}

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function api(method, query, body) {
    return fetch('/api/admin/comments' + (query || ''), {
      method: method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      if (r.status === 401) { signOut(); throw new Error('Wrong password.'); }
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong.'); return j; });
    });
  }

  function signOut() {
    token = '';
    try { sessionStorage.removeItem('admin-token'); } catch (_) {}
    login.hidden = false;
    bodyEl.hidden = true;
  }

  function show() {
    list.innerHTML = '<p class="muted">Loading…</p>';
    api('GET', '?status=' + status).then(function (data) {
      login.hidden = true;
      bodyEl.hidden = false;
      try { sessionStorage.setItem('admin-token', token); } catch (_) {}
      var items = data.comments || [];
      list.innerHTML = items.length ? items.map(item).join('') : '<p class="muted">' + (status === 'pending' ? 'Nothing waiting. All caught up.' : 'No published comments yet.') + '</p>';
    }).catch(function (err) { list.innerHTML = ''; alert(err.message); });
  }

  function item(c) {
    return '<div class="a-item" data-id="' + c.id + '">' +
      '<div class="a-meta"><strong>' + esc(c.name) + '</strong>' + (c.email ? ' · ' + esc(c.email) : '') + (c.notify ? ' · wants reply emails' : '') +
      '<br>on <a href="' + esc(c.post) + '#comment-' + c.id + '" target="_blank" rel="noopener">' + esc(c.post) + '</a> · ' + esc(new Date(c.created_at).toLocaleString()) +
      (c.parent_id ? ' · reply to #' + c.parent_id : '') + '</div>' +
      '<div class="a-body">' + esc(c.body) + '</div>' +
      '<div class="a-actions">' +
        (c.status === 'pending' ? '<button class="btn btn-sm" data-act="approve">Approve</button>' : '<button class="btn btn-ghost btn-sm" data-act="hide">Hide</button>') +
        '<button class="btn btn-ghost btn-sm" data-act="reply">Reply as author</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="delete">Delete</button>' +
      '</div></div>';
  }

  login.addEventListener('submit', function (e) {
    e.preventDefault();
    token = login.elements.token.value;
    show();
  });

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      status = t.dataset.status;
      tabs.forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
      show();
    });
  });

  list.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var box = btn.closest('.a-item');
    var id = Number(box.dataset.id);
    var act = btn.dataset.act;

    if (act === 'reply') {
      if (box.querySelector('.a-reply')) return;
      box.insertAdjacentHTML('beforeend', '<form class="a-reply"><textarea required placeholder="Your reply — it’s published straight away, with an Author badge."></textarea><span><button class="btn btn-sm" type="submit">Publish reply</button></span></form>');
      var form = box.querySelector('.a-reply');
      form.querySelector('textarea').focus();
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        api('POST', '', { id: id, action: 'reply', body: form.querySelector('textarea').value }).then(show).catch(function (err) { alert(err.message); });
      });
      return;
    }
    if (act === 'delete' && !confirm('Delete this comment and any replies to it? This can’t be undone.')) return;
    btn.disabled = true;
    api('POST', '', { id: id, action: act }).then(show).catch(function (err) { btn.disabled = false; alert(err.message); });
  });

  if (token) show();
})();
