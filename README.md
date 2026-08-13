# torisforum ✦

A sleek social forum with y2k undertones. Boards, posts with attachments,
likes, comments, a trending feed, and customizable profiles — all saved to
a real backend.

## Run it

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

## Host it

The app is a single Node process with SQLite and local file uploads, so it
runs on any host that gives you a persistent disk. Two easy options:

**Render** (recommended — `render.yaml` is included):

1. Push this repo to GitHub (already done if you're reading this there).
2. Go to [dashboard.render.com](https://dashboard.render.com) → **New →
   Blueprint**, and pick this repo. Render reads `render.yaml` and sets up
   the service with a 1GB persistent disk mounted at `/var/data` (the
   Starter plan is required for the disk; without one, posts and uploads
   are lost on every restart).
3. Deploy. Your forum is live at `https://<yourname>.onrender.com`.

**Railway**: New Project → Deploy from GitHub repo → add a **Volume**
mounted at `/var/data`, then set the environment variables
`DATA_DIR=/var/data/db`, `UPLOAD_DIR=/var/data/uploads`, and
`NODE_ENV=production`.

**Environment variables** (all optional):

| Variable         | Default            | What it does                        |
| ---------------- | ------------------ | ----------------------------------- |
| `PORT`           | `3000`             | Port the server listens on          |
| `DATA_DIR`       | `./data`           | Where the SQLite database lives     |
| `UPLOAD_DIR`     | `./uploads`        | Where uploaded files are stored     |
| `ADMIN_USERNAME` | `nicatoris`        | Admin account seeded on first boot  |
| `ADMIN_PASSWORD` | (see `db.js`)      | Admin password seeded on first boot |
| `NODE_ENV`       | —                  | Set `production` for Secure cookies |

> **Important:** the admin account is only created on first boot, when the
> database is empty. Set `ADMIN_PASSWORD` before the first deploy — the
> default is visible in this repo's source, so anyone could log in as
> admin if you keep it.

## What's inside

- **Backend:** Node.js + Express + SQLite (`better-sqlite3`). Everything —
  users, sessions, boards, posts, comments, likes, uploads — is persisted.
  The database lives in `data/forum.db`, uploaded files in `uploads/`.
- **Auth:** username + password accounts (bcrypt-hashed), httpOnly session
  cookies that survive server restarts.
- **Admin:** the `nicatoris` account is seeded as SYSOP on first boot.
  Admins get the `/admin` panel to create/delete boards (name, description,
  accent color) and can delete any post.
- **Posts:** title + body + optional attachment (images/video/audio render
  inline, anything else becomes a download pill; 8MB limit).
- **Home page:** trending feed (engagement score with time decay) +
  newest posts + board directory.
- **Profiles:** avatar upload, bio, tagline, accent color, and banner decor
  patterns (grid / stars / waves / circuit / static).

## Pages

| Route        | What                              |
| ------------ | --------------------------------- |
| `/`          | home — trending + fresh + boards  |
| `/board?b=`  | a board's feed (new / trending)   |
| `/post?id=`  | a post + its comments             |
| `/new`       | compose a post                    |
| `/user?u=`   | a user's profile                  |
| `/settings`  | profile customization             |
| `/admin`     | sysop board management            |
| `/login` `/register` | auth                      |
