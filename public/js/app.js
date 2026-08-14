/* TORISFORUM · shared client */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let ME = null;

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `error ${res.status}`);
  return data;
}

function timeAgo(unix) {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - unix));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(unix * 1000).toLocaleDateString();
}

function avatarHtml(user, size = '') {
  const cls = `avatar ${size}`.trim();
  if (user.avatar) {
    return `<img class="${cls}" src="${esc(user.avatar)}" alt="${esc(user.username)}">`;
  }
  const accent = user.accent || user.user_accent || '#2f6bff';
  return `<span class="${cls} avatar-fallback" style="background:${esc(accent)}">${esc(
    (user.username || '?')[0]
  )}</span>`;
}

/* ── nav ── */
let UNREAD = 0;

async function initNav() {
  try {
    const me = await api('/api/me');
    ME = me.user;
    UNREAD = me.unread_notifications || 0;
  } catch {
    ME = null;
  }
  // one fixed-width shell wraps header, page body, and footer
  const shell = document.createElement('div');
  shell.id = 'shell';
  const main = document.querySelector('main');
  document.body.insertBefore(shell, main);

  const bar = document.createElement('header');
  bar.className = 'topbar';
  const userHtml = ME
    ? `<a href="/user?u=${esc(ME.username)}" class="uname cell-r">${avatarHtml(ME)}<span>${esc(
        ME.username
      )}</span></a>
       <a class="cell-r" href="/activity">Activity${
         UNREAD ? ` <span class="notif-count">${UNREAD > 99 ? '99+' : UNREAD}</span>` : ''
       }</a>
       ${ME.is_admin ? '<a class="cell-r" href="/admin">Admin</a>' : ''}
       <a class="cell-r" href="/settings">Settings</a>
       <button class="cell-r" id="logout-btn">Log out</button>`
    : `<a class="cell-r" href="/login">Log in</a>
       <a class="cell-r" href="/register">Sign up</a>`;
  const stamp = new Date().toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  bar.innerHTML = `
    <div class="mast-top">
      <a class="logo" href="/">toris<em>forum</em></a>
      <span class="mast-stamp">${stamp}</span>
    </div>
    <nav class="navstrip" id="nav-boards">
      <a href="/">Home</a>
      <span class="sep"></span>
      <button class="theme-btn cell-r" id="theme-btn" title="switch display theme"></button>
      ${userHtml}
    </nav>`;
  shell.appendChild(bar);
  shell.appendChild(main);

  const themeBtn = $('#theme-btn');
  const paintThemeBtn = () => {
    themeBtn.textContent = document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode';
  };
  paintThemeBtn();
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {}
    paintThemeBtn();
  });

  $('#logout-btn')?.addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    location.href = '/';
  });

  // board links in nav, inserted before the spacer cell
  try {
    const { boards } = await api('/api/boards');
    const nav = $('#nav-boards');
    const sep = nav.querySelector('.sep');
    for (const b of boards.slice(0, 6)) {
      const a = document.createElement('a');
      a.href = `/board?b=${encodeURIComponent(b.slug)}`;
      a.textContent = '/' + b.slug;
      nav.insertBefore(a, sep);
    }
  } catch {}

  const foot = document.createElement('footer');
  foot.className = 'footer';
  foot.innerHTML = `&copy; 2026 <b>torisforum</b> &middot; all rights reserved`;
  shell.appendChild(foot);
}

/* ── post cards ── */
function postCardHtml(p, opts = {}) {
  const thumb =
    p.attachment && (p.attachment_type || '').startsWith('image/')
      ? `<img class="post-thumb" src="${esc(p.attachment)}" alt="" loading="lazy">`
      : '';
  const clip = p.attachment ? `<span class="clip">· attachment</span>` : '';
  const rank =
    opts.rank != null
      ? `<div class="rank ${opts.rank < 3 ? 'hot' : ''}">${String(opts.rank + 1).padStart(2, '0')}</div>`
      : '';
  return `
  <article class="post-card" data-id="${p.id}">
    ${rank}
    <div class="vote">
      <button class="like-btn ${p.liked ? 'liked' : ''}" data-like="${p.id}" title="like">♥</button>
      <span class="n" data-like-count="${p.id}">${p.like_count}</span>
    </div>
    <div class="main">
      <div class="post-meta">
        <a class="board-chip" style="--chip:${esc(p.board_accent)}" href="/board?b=${esc(p.board_slug)}">/${esc(
    p.board_slug
  )}</a>
        ${avatarHtml({ username: p.username, avatar: p.avatar, accent: p.user_accent })}
        <a href="/user?u=${esc(p.username)}">${esc(p.username)}</a>
        <span>·</span><span>${timeAgo(p.created_at)}</span>
      </div>
      <a class="post-title" href="/post?id=${p.id}">${esc(p.title)}</a>
      ${p.body ? `<div class="post-snippet">${esc(window.stripMarkdown ? stripMarkdown(p.body) : p.body)}</div>` : ''}
      <div class="post-foot">
        <span>${p.comment_count} comment${p.comment_count === 1 ? '' : 's'}</span>
        ${clip}
      </div>
    </div>
    ${thumb}
  </article>`;
}

function bindLikeButtons(root = document) {
  $$('[data-like]', root).forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!ME) return (location.href = '/login');
      const id = btn.dataset.like;
      try {
        const { liked, like_count } = await api(`/api/posts/${id}/like`, { method: 'POST' });
        $$(`[data-like="${id}"]`).forEach((b) => b.classList.toggle('liked', liked));
        $$(`[data-like-count="${id}"]`).forEach((n) => (n.textContent = like_count));
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

function showErr(el, msg) {
  el.textContent = msg;
  el.classList.add('show');
}

/* ═══ page controllers ═══ */

const PAGES = {
  /* ── home ── */
  async home() {
    const [{ newest, trending }, { boards }] = await Promise.all([api('/api/home'), api('/api/boards')]);

    $('#hero-cta').innerHTML = ME
      ? `<a class="btn primary" href="/new">New post</a>`
      : `<a class="btn primary" href="/register">Create an account</a><a class="btn" href="/login">Log in</a>`;

    $('#hd-boards').textContent = boards.length;
    $('#hd-posts').textContent = boards.reduce((n, b) => n + b.post_count, 0);

    $('#boards-grid').innerHTML = boards.length
      ? boards
          .map(
            (b) => `
        <a class="board-card" style="--chip:${esc(b.accent)}" href="/board?b=${esc(b.slug)}">
          <div class="bname">${esc(b.name)}</div>
          <div class="bdesc">${esc(b.description)}</div>
          <div class="bcount">${b.post_count} post${b.post_count === 1 ? '' : 's'}</div>
        </a>`
          )
          .join('')
      : '<div class="empty">No boards yet</div>';

    $('#trending-list').innerHTML = trending.length
      ? trending.map((p, i) => postCardHtml(p, { rank: i })).join('')
      : '<div class="empty">Nothing trending yet — be the first</div>';

    $('#new-list').innerHTML = newest.length
      ? newest.map((p) => postCardHtml(p)).join('')
      : '<div class="empty">Quiet in here. Post something.</div>';

    bindLikeButtons();
  },

  /* ── login / register ── */
  async login() {
    $('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('.form-err');
      err.classList.remove('show');
      try {
        await api('/api/login', {
          method: 'POST',
          body: JSON.stringify({ username: $('#username').value.trim(), password: $('#password').value }),
        });
        location.href = '/';
      } catch (ex) {
        showErr(err, ex.message);
      }
    });
  },

  async register() {
    $('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('.form-err');
      err.classList.remove('show');
      try {
        await api('/api/register', {
          method: 'POST',
          body: JSON.stringify({ username: $('#username').value.trim(), password: $('#password').value }),
        });
        location.href = '/';
      } catch (ex) {
        showErr(err, ex.message);
      }
    });
  },

  /* ── board ── */
  async board() {
    const slug = new URLSearchParams(location.search).get('b');
    let sort = 'new';

    async function load() {
      const { board, posts } = await api(`/api/boards/${encodeURIComponent(slug)}/posts?sort=${sort}`);
      document.title = `/${board.slug} · TORISFORUM`;
      $('#board-head').innerHTML = `
        <div class="hero">
          <h1 style="font-size:18px"><span style="color:${esc(board.accent)}">/</span>${esc(board.name)}</h1>
          <div class="sub">${esc(board.description)}</div>
          <div class="actions">${
            ME
              ? `<a class="btn primary" href="/new?b=${esc(board.slug)}">New post</a>`
              : `<a class="btn" href="/login">Log in to post</a>`
          }</div>
        </div>`;
      $('#board-posts').innerHTML = posts.length
        ? posts.map((p) => postCardHtml(p)).join('')
        : '<div class="empty">This board is empty — start it off.</div>';
      bindLikeButtons();
    }

    $$('.sort-tabs button').forEach((b) =>
      b.addEventListener('click', () => {
        $$('.sort-tabs button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        sort = b.dataset.sort;
        load();
      })
    );

    try {
      await load();
    } catch (e) {
      $('#board-posts').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
  },

  /* ── new post ── */
  async newPost() {
    if (!ME) return (location.href = '/login');
    const { boards } = await api('/api/boards');
    const preselect = new URLSearchParams(location.search).get('b');
    const sel = $('#board-select');
    sel.innerHTML = boards
      .map(
        (b) => `<option value="${b.id}" ${b.slug === preselect ? 'selected' : ''}>/${esc(b.slug)} — ${esc(b.name)}</option>`
      )
      .join('');

    // formatting toolbar
    const body = $('#body');
    const surround = (pre, post, placeholder) => {
      const s = body.selectionStart, e = body.selectionEnd;
      const sel = body.value.slice(s, e) || placeholder;
      body.setRangeText(pre + sel + post, s, e);
      body.focus();
      body.setSelectionRange(s + pre.length, s + pre.length + sel.length);
    };
    const prefixLines = (prefix) => {
      const s = body.selectionStart, e = body.selectionEnd;
      const start = body.value.lastIndexOf('\n', s - 1) + 1;
      const chunk = body.value.slice(start, e || start);
      const changed = (chunk || 'text').split('\n').map((l) => prefix + l).join('\n');
      body.setRangeText(changed, start, e, 'end');
      body.focus();
    };
    const actions = {
      bold: () => surround('**', '**', 'bold text'),
      italic: () => surround('*', '*', 'italic text'),
      strike: () => surround('~~', '~~', 'crossed out'),
      heading: () => prefixLines('## '),
      link: () => surround('[', '](https://)', 'link text'),
      quote: () => prefixLines('> '),
      code: () => {
        const sel = body.value.slice(body.selectionStart, body.selectionEnd);
        if (sel.includes('\n')) surround('```\n', '\n```', 'code');
        else surround('`', '`', 'code');
      },
      list: () => prefixLines('- '),
    };
    $$('#md-toolbar [data-md]').forEach((b) => b.addEventListener('click', () => actions[b.dataset.md]()));

    const pvBtn = $('#md-preview-btn');
    const pv = $('#md-preview');
    pvBtn.addEventListener('click', () => {
      if (pv.hidden) {
        pv.innerHTML = body.value.trim() ? renderMarkdown(body.value) : '<span class="hint">Nothing to preview yet.</span>';
        pv.hidden = false;
        pvBtn.textContent = 'Hide preview';
      } else {
        pv.hidden = true;
        pvBtn.textContent = 'Preview';
      }
    });

    const fileInput = $('#attachment');
    fileInput.addEventListener('change', () => {
      $('#file-name').textContent = fileInput.files[0]
        ? fileInput.files[0].name
        : 'Attach a file — image, video, whatever (8MB max)';
    });

    $('#post-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('.form-err');
      err.classList.remove('show');
      const btn = $('#submit-btn');
      btn.disabled = true;
      try {
        const fd = new FormData();
        fd.append('board_id', sel.value);
        fd.append('title', $('#title').value.trim());
        fd.append('body', $('#body').value);
        if (fileInput.files[0]) fd.append('attachment', fileInput.files[0]);
        const { id } = await api('/api/posts', { method: 'POST', body: fd });
        location.href = `/post?id=${id}`;
      } catch (ex) {
        showErr(err, ex.message);
        btn.disabled = false;
      }
    });
  },

  /* ── single post ── */
  async post() {
    const id = new URLSearchParams(location.search).get('id');
    let data;
    try {
      data = await api(`/api/posts/${encodeURIComponent(id)}`);
    } catch (e) {
      $('#post-root').innerHTML = `<div class="empty" style="margin-top:40px">${esc(e.message)}</div>`;
      return;
    }
    const { post, comments } = data;
    document.title = `${post.title} · TORISFORUM`;

    let attach = '';
    if (post.attachment) {
      const t = post.attachment_type || '';
      if (t.startsWith('image/')) {
        attach = `<div class="attachment-view"><img src="${esc(post.attachment)}" alt=""></div>`;
      } else if (t.startsWith('video/')) {
        attach = `<div class="attachment-view"><video src="${esc(post.attachment)}" controls></video></div>`;
      } else if (t.startsWith('audio/')) {
        attach = `<div class="attachment-view"><audio src="${esc(post.attachment)}" controls></audio></div>`;
      } else {
        attach = `<div class="attachment-view"><a class="file-pill" href="${esc(post.attachment)}" download="${esc(
          post.attachment_name || 'file'
        )}">↓ ${esc(post.attachment_name || 'Download file')}</a></div>`;
      }
    }

    const canDelete = ME && (ME.is_admin || ME.username === post.username);

    $('#post-root').innerHTML = `
      <div class="crumbs"><a href="/">Home</a> / <a href="/board?b=${esc(post.board_slug)}">/${esc(
      post.board_slug
    )}</a> / post #${post.id}</div>
      <div class="win post-full">
        <div class="win-title">/${esc(post.board_slug)}<div class="dots"><i></i><i></i><i></i></div></div>
        <div class="win-body roomy">
          <div class="post-meta">
            <a class="board-chip" style="--chip:${esc(post.board_accent)}" href="/board?b=${esc(
      post.board_slug
    )}">/${esc(post.board_slug)}</a>
            ${avatarHtml({ username: post.username, avatar: post.avatar, accent: post.user_accent })}
            <a href="/user?u=${esc(post.username)}">${esc(post.username)}</a>
            <span>·</span><span>${timeAgo(post.created_at)}</span>
          </div>
          <h1>${esc(post.title)}</h1>
          ${post.body ? `<div class="post-body">${renderMarkdown(post.body)}</div>` : ''}
          ${attach}
          <div style="display:flex;gap:12px;align-items:center;margin-top:20px">
            <button class="like-btn ${post.liked ? 'liked' : ''}" data-like="${post.id}">♥</button>
            <span class="n" data-like-count="${post.id}" style="color:var(--dim);font-size:12px">${
      post.like_count
    }</span>
            ${canDelete ? `<button class="btn ghost danger" id="del-post" style="margin-left:auto">Delete</button>` : ''}
          </div>
        </div>
      </div>

      <div class="sec-head"><h2>Comments (${comments.length})</h2><div class="rule"></div></div>
      <div id="comment-form-slot"></div>
      <div id="comments"></div>`;

    $('#comments').innerHTML = comments.length
      ? comments.map(commentHtml).join('')
      : '<div class="empty">No comments yet — say something.</div>';

    $('#comment-form-slot').innerHTML = ME
      ? `<form id="comment-form" class="comment-form">
           <textarea id="comment-body" placeholder="Write a reply…"></textarea>
           <button class="btn primary">Reply</button>
         </form>`
      : `<div class="empty" style="padding:18px;margin-bottom:18px"><a href="/login">Log in</a> to join the conversation</div>`;

    $('#comment-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = $('#comment-body').value.trim();
      if (!body) return;
      try {
        const { comment } = await api(`/api/posts/${post.id}/comments`, {
          method: 'POST',
          body: JSON.stringify({ body }),
        });
        if ($('#comments .empty')) $('#comments').innerHTML = '';
        $('#comments').insertAdjacentHTML('beforeend', commentHtml(comment));
        $('#comment-body').value = '';
      } catch (ex) {
        alert(ex.message);
      }
    });

    $('#del-post')?.addEventListener('click', async () => {
      if (!confirm('Delete this post permanently?')) return;
      await api(`/api/posts/${post.id}`, { method: 'DELETE' });
      location.href = `/board?b=${post.board_slug}`;
    });

    bindLikeButtons();

    function commentHtml(c) {
      return `
      <div class="comment">
        ${avatarHtml({ username: c.username, avatar: c.avatar, accent: c.user_accent }, 'md')}
        <div style="flex:1;min-width:0">
          <div class="c-meta"><a href="/user?u=${esc(c.username)}">${esc(c.username)}</a> · ${timeAgo(
        c.created_at
      )}</div>
          <div class="c-body">${esc(c.body)}</div>
        </div>
      </div>`;
    }
  },

  /* ── profile ── */
  async profile() {
    const uname = new URLSearchParams(location.search).get('u');
    let data;
    try {
      data = await api(`/api/users/${encodeURIComponent(uname)}`);
    } catch (e) {
      $('#profile-root').innerHTML = `<div class="empty" style="margin-top:40px">${esc(e.message)}</div>`;
      return;
    }
    const { user, posts, stats, badges, is_following } = data;
    document.title = `@${user.username} · torisforum`;
    const accent = user.accent || '#2f6bff';

    const isMe = ME && ME.username === user.username;
    const actionBtn = isMe
      ? '<a class="btn" href="/settings" style="margin-left:auto;align-self:center">Edit profile</a>'
      : ME
      ? `<button class="btn ${is_following ? '' : 'primary'}" id="follow-btn" style="margin-left:auto;align-self:center">${
          is_following ? 'Unfollow' : 'Follow'
        }</button>`
      : '';

    const badgesHtml = badges.length
      ? `<div class="badge-row">${badges
          .map(
            (b) =>
              `<span class="badge-chip" style="--b-color:${esc(b.color)}" title="${esc(b.description)}"><i>${esc(
                b.icon
              )}</i>${esc(b.name)}</span>`
          )
          .join('')}</div>`
      : '';

    $('#profile-root').innerHTML = `
      <div class="profile-head" style="--p-accent:${esc(accent)};--p-glow:color-mix(in srgb, ${esc(
      accent
    )} 14%, transparent)">
        <div class="profile-banner decor-${esc(user.decor || 'grid')}"></div>
        <div class="profile-info">
          <div class="row">
            ${avatarHtml(user, 'lg')}
            <div style="padding-bottom:6px">
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <span class="profile-name" style="font-family:var(--font-head)">${esc(user.username)}</span>
                ${user.is_admin ? '<span class="admin-badge">ADMIN</span>' : ''}
              </div>
              <div style="display:flex;gap:8px;margin-top:6px;align-items:center;flex-wrap:wrap">
                ${user.tagline ? `<span class="profile-tagline">${esc(user.tagline)}</span>` : ''}
                <span style="font-size:11px;color:var(--dimmer)">joined ${new Date(
                  user.created_at * 1000
                ).toLocaleDateString()}</span>
              </div>
            </div>
            ${actionBtn}
          </div>
          ${user.bio ? `<div class="profile-bio">${esc(user.bio)}</div>` : ''}
          ${badgesHtml}
          <div class="profile-stats">
            <div class="stat"><b>${stats.posts}</b><span>posts</span></div>
            <div class="stat"><b>${stats.comments}</b><span>comments</span></div>
            <div class="stat"><b>${stats.likes_received}</b><span>likes received</span></div>
            <div class="stat"><b id="follower-count">${stats.followers}</b><span>followers</span></div>
            <div class="stat"><b>${stats.following}</b><span>following</span></div>
          </div>
        </div>
      </div>
      <div class="sec-head"><h2>Posts by ${esc(user.username)}</h2><span class="tag">${stats.posts} total</span><div class="rule"></div></div>
      <div id="profile-posts"></div>`;

    $('#profile-posts').innerHTML = posts.length
      ? posts.map((p) => postCardHtml(p)).join('')
      : '<div class="empty">No posts yet</div>';
    bindLikeButtons();

    $('#follow-btn')?.addEventListener('click', async () => {
      const btn = $('#follow-btn');
      try {
        const { following, followers } = await api(`/api/users/${encodeURIComponent(user.username)}/follow`, {
          method: 'POST',
        });
        btn.textContent = following ? 'Unfollow' : 'Follow';
        btn.classList.toggle('primary', !following);
        $('#follower-count').textContent = followers;
      } catch (ex) {
        alert(ex.message);
      }
    });
  },

  /* ── activity: notifications + following feed ── */
  async activity() {
    if (!ME) return (location.href = '/login');

    const panes = { notifications: $('#tab-notifications'), following: $('#tab-following') };
    $$('.sort-tabs button').forEach((b) =>
      b.addEventListener('click', () => {
        $$('.sort-tabs button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        for (const [name, el] of Object.entries(panes)) el.hidden = name !== b.dataset.tab;
      })
    );

    function notifHtml(n) {
      const who = n.actor_username
        ? `<a href="/user?u=${esc(n.actor_username)}"><b>${esc(n.actor_username)}</b></a>`
        : '';
      const postLink = n.post_id ? `<a href="/post?id=${n.post_id}">${esc(n.post_title || 'your post')}</a>` : '';
      let text = '';
      if (n.type === 'like') text = `${who} liked your post ${postLink}`;
      else if (n.type === 'comment') text = `${who} commented on your post ${postLink}`;
      else if (n.type === 'follow') text = `${who} followed you`;
      else if (n.type === 'badge')
        text = `You earned the badge <span class="badge-chip" style="--b-color:${esc(
          n.badge_color || '#3f6b9a'
        )}"><i>${esc(n.badge_icon || '★')}</i>${esc(n.badge_name || 'badge')}</span>`;
      else return '';
      const av = n.actor_username
        ? avatarHtml({ username: n.actor_username, avatar: n.actor_avatar, accent: n.actor_accent }, 'md')
        : '<span class="avatar md avatar-fallback" style="background:var(--accent2)">✦</span>';
      return `
        <div class="notif ${n.read ? '' : 'unread'}">
          ${av}
          <div style="flex:1;min-width:0">
            <div class="notif-text">${text}</div>
            <div class="notif-time">${timeAgo(n.created_at)}</div>
          </div>
        </div>`;
    }

    try {
      const { notifications } = await api('/api/notifications');
      panes.notifications.innerHTML = notifications.length
        ? notifications.map(notifHtml).join('')
        : '<div class="empty">Nothing yet. When someone likes, comments, or follows, it shows up here.</div>';
      if (notifications.some((n) => !n.read)) {
        await api('/api/notifications/read', { method: 'POST' });
        document.querySelectorAll('.notif-count').forEach((el) => el.remove());
      }
    } catch (e) {
      panes.notifications.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }

    try {
      const { posts } = await api('/api/feed');
      panes.following.innerHTML = posts.length
        ? posts.map((p) => postCardHtml(p)).join('')
        : '<div class="empty">No posts from people you follow yet. Visit a profile and hit Follow.</div>';
      bindLikeButtons(panes.following);
    } catch (e) {
      panes.following.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
  },

  /* ── settings ── */
  async settings() {
    if (!ME) return (location.href = '/login');
    const COLORS = ['#2f6bff', '#7c5cff', '#ef5da8', '#f59e0b', '#10b981', '#0ea5e9', '#64748b', '#1f2937'];
    const DECORS = ['grid', 'stars', 'waves', 'circuit', 'static', 'none'];
    let accent = ME.accent;
    let decor = ME.decor;

    $('#bio').value = ME.bio || '';
    $('#tagline').value = ME.tagline || '';
    $('#current-avatar').innerHTML = avatarHtml(ME, 'lg');

    $('#color-pick').innerHTML = COLORS.map(
      (c) =>
        `<div class="cswatch ${c === accent ? 'sel' : ''}" data-c="${c}" style="background:${c};color:${c}"></div>`
    ).join('');
    $$('#color-pick .cswatch').forEach((s) =>
      s.addEventListener('click', () => {
        accent = s.dataset.c;
        $$('#color-pick .cswatch').forEach((x) => x.classList.toggle('sel', x === s));
        renderDecors();
      })
    );

    function renderDecors() {
      $('#decor-pick').innerHTML = DECORS.map(
        (d) =>
          `<div class="swatch decor-${d} ${d === decor ? 'sel' : ''}" data-d="${d}"
            style="--p-accent:${accent};--p-glow:color-mix(in srgb, ${accent} 20%, transparent)"><span>${d}</span></div>`
      ).join('');
      $$('#decor-pick .swatch').forEach((s) =>
        s.addEventListener('click', () => {
          decor = s.dataset.d;
          $$('#decor-pick .swatch').forEach((x) => x.classList.toggle('sel', x === s));
        })
      );
    }
    renderDecors();

    const avatarInput = $('#avatar');
    avatarInput.addEventListener('change', () => {
      if (avatarInput.files[0]) {
        $('#avatar-name').textContent = `⎙ ${avatarInput.files[0].name}`;
        const url = URL.createObjectURL(avatarInput.files[0]);
        $('#current-avatar').innerHTML = `<img class="avatar lg" src="${url}">`;
      }
    });

    $('#settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('.form-err');
      const ok = $('.form-ok');
      err.classList.remove('show');
      ok.classList.remove('show');
      try {
        const fd = new FormData();
        fd.append('bio', $('#bio').value);
        fd.append('tagline', $('#tagline').value);
        fd.append('accent', accent);
        fd.append('decor', decor);
        if (avatarInput.files[0]) fd.append('avatar', avatarInput.files[0]);
        const { user } = await api('/api/profile', { method: 'POST', body: fd });
        ME = user;
        ok.textContent = 'Saved — looking good.';
        ok.classList.add('show');
      } catch (ex) {
        showErr(err, ex.message);
      }
    });
  },

  /* ── admin ── */
  async admin() {
    if (!ME) return (location.href = '/login');
    if (!ME.is_admin) {
      $('#admin-root').innerHTML = '<div class="empty" style="margin-top:40px">This area is for admins only.</div>';
      return;
    }
    let accent = '#2f6bff';
    const COLORS = ['#2f6bff', '#7c5cff', '#ef5da8', '#f59e0b', '#10b981', '#0ea5e9', '#64748b', '#1f2937'];
    $('#b-color-pick').innerHTML = COLORS.map(
      (c) =>
        `<div class="cswatch ${c === accent ? 'sel' : ''}" data-c="${c}" style="background:${c};color:${c}"></div>`
    ).join('');
    $$('#b-color-pick .cswatch').forEach((s) =>
      s.addEventListener('click', () => {
        accent = s.dataset.c;
        $$('#b-color-pick .cswatch').forEach((x) => x.classList.toggle('sel', x === s));
      })
    );

    async function loadBoards() {
      const { boards } = await api('/api/boards');
      $('#board-rows').innerHTML = boards
        .map(
          (b) => `
        <tr>
          <td><a href="/board?b=${esc(b.slug)}" style="color:${esc(b.accent)}">/${esc(b.slug)}</a></td>
          <td style="color:var(--dim)">${esc(b.description)}</td>
          <td>${b.post_count}</td>
          <td><button class="btn ghost danger" data-del-board="${b.id}" style="padding:4px 10px">×</button></td>
        </tr>`
        )
        .join('');
      $$('[data-del-board]').forEach((btn) =>
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this board AND all its posts?')) return;
          await api(`/api/boards/${btn.dataset.delBoard}`, { method: 'DELETE' });
          loadBoards();
        })
      );
    }
    await loadBoards();

    $('#board-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('.form-err');
      err.classList.remove('show');
      try {
        await api('/api/boards', {
          method: 'POST',
          body: JSON.stringify({
            name: $('#b-name').value.trim(),
            description: $('#b-desc').value.trim(),
            accent,
          }),
        });
        $('#b-name').value = '';
        $('#b-desc').value = '';
        await loadBoards();
      } catch (ex) {
        showErr(err, ex.message);
      }
    });

    // ── badges ──
    let badgeColor = '#3f6b9a';
    const BADGE_COLORS = ['#3f6b9a', '#b06f1f', '#a83a6e', '#2f7d4f', '#7c5cff', '#b03030', '#4a8f8f', '#5b6a85'];
    $('#bd-color-pick').innerHTML = BADGE_COLORS.map(
      (c) => `<div class="cswatch ${c === badgeColor ? 'sel' : ''}" data-c="${c}" style="background:${c}"></div>`
    ).join('');
    $$('#bd-color-pick .cswatch').forEach((s) =>
      s.addEventListener('click', () => {
        badgeColor = s.dataset.c;
        $$('#bd-color-pick .cswatch').forEach((x) => x.classList.toggle('sel', x === s));
      })
    );

    let condTypes = {};
    async function loadBadges() {
      const { badges, cond_types } = await api('/api/badges');
      condTypes = cond_types;
      $('#bd-cond').innerHTML = Object.entries(cond_types)
        .map(([k, label]) => `<option value="${k}">${esc(label)}</option>`)
        .join('');
      $('#badge-rows').innerHTML = badges.length
        ? badges
            .map(
              (b) => `
          <tr>
            <td><span class="badge-chip" style="--b-color:${esc(b.color)}" title="${esc(b.description)}"><i>${esc(
                b.icon
              )}</i>${esc(b.name)}</span></td>
            <td style="color:var(--dim)">${esc(condTypes[b.cond_type] || b.cond_type)} ≥ ${b.threshold}</td>
            <td>${b.holder_count}</td>
            <td><button class="btn ghost danger" data-del-badge="${b.id}" style="padding:2px 8px">×</button></td>
          </tr>`
            )
            .join('')
        : '<tr><td colspan="4" style="color:var(--dimmer)">No badges yet</td></tr>';
      $$('[data-del-badge]').forEach((btn) =>
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this badge? Everyone who earned it loses it.')) return;
          await api(`/api/badges/${btn.dataset.delBadge}`, { method: 'DELETE' });
          loadBadges();
        })
      );
    }
    await loadBadges();

    $('#badge-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#badge-err');
      err.classList.remove('show');
      try {
        await api('/api/badges', {
          method: 'POST',
          body: JSON.stringify({
            name: $('#bd-name').value.trim(),
            icon: $('#bd-icon').value.trim(),
            description: $('#bd-desc').value.trim(),
            cond_type: $('#bd-cond').value,
            threshold: $('#bd-threshold').value,
            color: badgeColor,
          }),
        });
        $('#bd-name').value = '';
        $('#bd-icon').value = '';
        $('#bd-desc').value = '';
        $('#bd-threshold').value = '1';
        await loadBadges();
      } catch (ex) {
        showErr(err, ex.message);
      }
    });
  },
};

/* boot */
document.addEventListener('DOMContentLoaded', async () => {
  await initNav();
  const page = document.body.dataset.page;
  if (page && PAGES[page]) {
    try {
      await PAGES[page]();
    } catch (e) {
      console.error(e);
    }
  }
});
