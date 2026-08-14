const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'forum.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  bio TEXT NOT NULL DEFAULT '',
  tagline TEXT NOT NULL DEFAULT '',
  avatar TEXT,
  accent TEXT NOT NULL DEFAULT '#2f6bff',
  decor TEXT NOT NULL DEFAULT 'grid',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  accent TEXT NOT NULL DEFAULT '#2f6bff',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  attachment TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS likes (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (follower_id, followee_id)
);

CREATE TABLE IF NOT EXISTS badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  icon TEXT NOT NULL DEFAULT '★',
  color TEXT NOT NULL DEFAULT '#3f6b9a',
  description TEXT NOT NULL DEFAULT '',
  cond_type TEXT NOT NULL,
  threshold INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  badge_id INTEGER REFERENCES badges(id) ON DELETE CASCADE,
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_posts_board ON posts(board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
`);

// ---- seed admin + starter boards ----
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'nicatoris';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Nicatorisjapan1!';

const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get(ADMIN_USERNAME);
if (!adminExists) {
  db.prepare(
    'INSERT INTO users (username, password_hash, is_admin, bio, tagline, accent, decor) VALUES (?, ?, 1, ?, ?, ?, ?)'
  ).run(
    ADMIN_USERNAME,
    bcrypt.hashSync(ADMIN_PASSWORD, 10),
    'Admin of vipnet.',
    'administrator',
    '#7c5cff',
    'stars'
  );
  console.log('[db] seeded admin account:', ADMIN_USERNAME);
}

const boardCount = db.prepare('SELECT COUNT(*) AS n FROM boards').get().n;
if (boardCount === 0) {
  const ins = db.prepare('INSERT INTO boards (slug, name, description, accent) VALUES (?, ?, ?, ?)');
  ins.run('general', 'general', 'Anything and everything — the main channel.', '#2f6bff');
  ins.run('media', 'media', 'Pictures, clips, and files worth sharing.', '#ef5da8');
  ins.run('tech', 'tech', 'Computers, code, and gear.', '#10b981');
  console.log('[db] seeded starter boards');
}

const badgeCount = db.prepare('SELECT COUNT(*) AS n FROM badges').get().n;
if (badgeCount === 0) {
  const ins = db.prepare(
    'INSERT INTO badges (name, icon, color, description, cond_type, threshold) VALUES (?, ?, ?, ?, ?, ?)'
  );
  ins.run('First post', '✎', '#3f6b9a', 'Made your first post.', 'posts', 1);
  ins.run('Regular', '✦', '#b06f1f', 'Made ten posts.', 'posts', 10);
  ins.run('Well liked', '♥', '#a83a6e', 'Received ten likes.', 'likes_received', 10);
  console.log('[db] seeded starter badges');
}

module.exports = db;
