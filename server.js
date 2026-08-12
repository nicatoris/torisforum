const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 10).replace(/[^.a-z0-9]/g, '');
      cb(null, crypto.randomBytes(12).toString('hex') + ext);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// ---- session helpers ----
function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie;
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

app.use((req, res, next) => {
  const token = parseCookies(req).session;
  req.user = null;
  if (token) {
    const row = db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.created_at > unixepoch() - ${SESSION_MAX_AGE}`
      )
      .get(token);
    if (row) req.user = row;
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'you need to log in first.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'admins only.' });
  next();
}

function setSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
  res.setHeader(
    'Set-Cookie',
    `session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_MAX_AGE}; SameSite=Lax`
  );
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    is_admin: !!u.is_admin,
    bio: u.bio,
    tagline: u.tagline,
    avatar: u.avatar,
    accent: u.accent,
    decor: u.decor,
    created_at: u.created_at,
  };
}

// Trending: engagement decayed by age. score = (likes*3 + comments*2 + 1) / (hours + 2)^1.4
const TREND_SCORE = `
  (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) * 3.0
  + (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) * 2.0
  + 1.0
`;
const POST_SELECT = `
  SELECT p.id, p.title, p.body, p.attachment, p.attachment_name, p.attachment_type, p.created_at,
    b.slug AS board_slug, b.name AS board_name, b.accent AS board_accent,
    u.username, u.avatar, u.accent AS user_accent,
    (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
    (${TREND_SCORE}) / pow(((unixepoch() - p.created_at) / 3600.0) + 2.0, 1.4) AS trend_score
  FROM posts p
  JOIN boards b ON b.id = p.board_id
  JOIN users u ON u.id = p.user_id
`;

function attachLiked(posts, user) {
  if (!user) return posts.map((p) => ({ ...p, liked: false }));
  const likedStmt = db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?');
  return posts.map((p) => ({ ...p, liked: !!likedStmt.get(p.id, user.id) }));
}

// ---- auth ----
app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'username must be 3-20 chars: letters, numbers, underscores.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters.' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'that username is taken.' });
  const info = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(username, bcrypt.hashSync(password, 10));
  setSession(res, info.lastInsertRowid);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)) });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || ''));
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'wrong username or password.' });
  }
  setSession(res, user.id);
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  const token = parseCookies(req).session;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ---- boards ----
app.get('/api/boards', (req, res) => {
  const boards = db
    .prepare(
      `SELECT b.*, (SELECT COUNT(*) FROM posts p WHERE p.board_id = b.id) AS post_count
       FROM boards b ORDER BY b.created_at ASC`
    )
    .all();
  res.json({ boards });
});

app.post('/api/boards', requireAdmin, (req, res) => {
  const { name, description, accent } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 30) {
    return res.status(400).json({ error: 'board name required (max 30 chars).' });
  }
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) return res.status(400).json({ error: 'name must contain letters or numbers.' });
  if (db.prepare('SELECT id FROM boards WHERE slug = ?').get(slug)) {
    return res.status(409).json({ error: 'a board with that name already exists.' });
  }
  const safeAccent = /^#[0-9a-fA-F]{6}$/.test(accent || '') ? accent : '#00f0ff';
  const info = db
    .prepare('INSERT INTO boards (slug, name, description, accent) VALUES (?, ?, ?, ?)')
    .run(slug, name.trim(), String(description || '').slice(0, 200), safeAccent);
  res.json({ board: db.prepare('SELECT * FROM boards WHERE id = ?').get(info.lastInsertRowid) });
});

app.delete('/api/boards/:id', requireAdmin, (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
  if (!board) return res.status(404).json({ error: 'board not found.' });
  db.prepare('DELETE FROM boards WHERE id = ?').run(board.id);
  res.json({ ok: true });
});

// ---- home feed ----
app.get('/api/home', (req, res) => {
  const newest = db.prepare(`${POST_SELECT} ORDER BY p.created_at DESC LIMIT 20`).all();
  const trending = db
    .prepare(`${POST_SELECT} WHERE p.created_at > unixepoch() - 60*60*24*14 ORDER BY trend_score DESC LIMIT 10`)
    .all();
  res.json({ newest: attachLiked(newest, req.user), trending: attachLiked(trending, req.user) });
});

// ---- posts ----
app.get('/api/boards/:slug/posts', (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE slug = ?').get(req.params.slug);
  if (!board) return res.status(404).json({ error: 'board not found.' });
  const sort = req.query.sort === 'trending' ? 'trend_score DESC' : 'p.created_at DESC';
  const posts = db.prepare(`${POST_SELECT} WHERE p.board_id = ? ORDER BY ${sort} LIMIT 50`).all(board.id);
  res.json({ board, posts: attachLiked(posts, req.user) });
});

app.post('/api/posts', requireAuth, upload.single('attachment'), (req, res) => {
  const { board_id, title, body } = req.body || {};
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(board_id);
  if (!board) return res.status(400).json({ error: 'pick a valid board.' });
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 140) {
    return res.status(400).json({ error: 'title required (max 140 chars).' });
  }
  const cleanBody = String(body || '').slice(0, 10000);
  let attachment = null, attachmentName = null, attachmentType = null;
  if (req.file) {
    attachment = '/uploads/' + req.file.filename;
    attachmentName = req.file.originalname.slice(0, 120);
    attachmentType = req.file.mimetype;
  }
  const info = db
    .prepare(
      'INSERT INTO posts (board_id, user_id, title, body, attachment, attachment_name, attachment_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(board.id, req.user.id, title.trim(), cleanBody, attachment, attachmentName, attachmentType);
  res.json({ id: info.lastInsertRowid });
});

app.get('/api/posts/:id', (req, res) => {
  const post = db.prepare(`${POST_SELECT} WHERE p.id = ?`).get(req.params.id);
  if (!post) return res.status(404).json({ error: 'post not found.' });
  const comments = db
    .prepare(
      `SELECT c.id, c.body, c.created_at, u.username, u.avatar, u.accent AS user_accent
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ? ORDER BY c.created_at ASC`
    )
    .all(post.id);
  res.json({ post: attachLiked([post], req.user)[0], comments });
});

app.delete('/api/posts/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'post not found.' });
  if (post.user_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'not your post.' });
  }
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
  res.json({ ok: true });
});

app.post('/api/posts/:id/like', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'post not found.' });
  const existing = db
    .prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?')
    .get(post.id, req.user.id);
  if (existing) {
    db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(post.id, req.user.id);
  } else {
    db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').run(post.id, req.user.id);
  }
  const count = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE post_id = ?').get(post.id).n;
  res.json({ liked: !existing, like_count: count });
});

app.post('/api/posts/:id/comments', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'post not found.' });
  const body = String((req.body || {}).body || '').trim().slice(0, 4000);
  if (!body) return res.status(400).json({ error: 'comment cannot be empty.' });
  const info = db
    .prepare('INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)')
    .run(post.id, req.user.id, body);
  const comment = db
    .prepare(
      `SELECT c.id, c.body, c.created_at, u.username, u.avatar, u.accent AS user_accent
       FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(info.lastInsertRowid);
  res.json({ comment });
});

// ---- profiles ----
app.get('/api/users/:username', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
  if (!user) return res.status(404).json({ error: 'user not found.' });
  const posts = db
    .prepare(`${POST_SELECT} WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT 50`)
    .all(user.id);
  const stats = {
    posts: db.prepare('SELECT COUNT(*) AS n FROM posts WHERE user_id = ?').get(user.id).n,
    comments: db.prepare('SELECT COUNT(*) AS n FROM comments WHERE user_id = ?').get(user.id).n,
    likes_received: db
      .prepare('SELECT COUNT(*) AS n FROM likes l JOIN posts p ON p.id = l.post_id WHERE p.user_id = ?')
      .get(user.id).n,
  };
  res.json({ user: publicUser(user), posts: attachLiked(posts, req.user), stats });
});

const DECORS = ['grid', 'stars', 'waves', 'circuit', 'static', 'none'];

app.post('/api/profile', requireAuth, upload.single('avatar'), (req, res) => {
  const { bio, tagline, accent, decor } = req.body || {};
  const updates = { bio: undefined, tagline: undefined, accent: undefined, decor: undefined, avatar: undefined };
  if (typeof bio === 'string') updates.bio = bio.slice(0, 500);
  if (typeof tagline === 'string') updates.tagline = tagline.slice(0, 60);
  if (typeof accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(accent)) updates.accent = accent;
  if (typeof decor === 'string' && DECORS.includes(decor)) updates.decor = decor;
  if (req.file) {
    if (!req.file.mimetype.startsWith('image/')) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'avatar must be an image.' });
    }
    updates.avatar = '/uploads/' + req.file.filename;
  }
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (sets.length) {
    vals.push(req.user.id);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

// ---- html routes (clean urls) ----
const pages = {
  '/': 'index.html',
  '/login': 'login.html',
  '/register': 'register.html',
  '/board': 'board.html',
  '/post': 'post.html',
  '/user': 'profile.html',
  '/settings': 'settings.html',
  '/admin': 'admin.html',
  '/new': 'new-post.html',
};
for (const [route, file] of Object.entries(pages)) {
  app.get(route, (req, res) => res.sendFile(path.join(__dirname, 'public', file)));
}

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'file too big — 8MB max.' });
  }
  console.error(err);
  res.status(500).json({ error: 'server error.' });
});

app.listen(PORT, () => {
  console.log(`TORISFORUM online → http://localhost:${PORT}`);
});
