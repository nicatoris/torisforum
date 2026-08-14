# vipnet ✦

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

> **Important:** the default admin password is visible in this repo's
> source, so set `ADMIN_PASSWORD` to something of your own.
>
> Setting `ADMIN_PASSWORD` works at any time, not just on the first
> deploy: whenever the server starts with that variable set, it updates
> the admin account to match and signs out that account's existing
> sessions, so a leaked or forgotten password can be rotated by adding
> the variable and redeploying. Posts, boards, and members are untouched.

## What's inside

- **Backend:** Node.js + Express + SQLite (`better-sqlite3`). Everything —
  users, sessions, boards, posts, comments, likes, uploads — is persisted.
  The database lives in `data/forum.db`, uploaded files in `uploads/`.
- **Auth:** username + password accounts (bcrypt-hashed), httpOnly session
  cookies that survive server restarts.
- **Admin:** the `nicatoris` account is seeded as an admin on first boot.
  Admins get the `/admin` panel to create/delete boards (name, description,
  accent color) and can delete any post.
- **Posts:** title + body + optional attachment (images/video/audio render
  inline, anything else becomes a download pill; 8MB limit). Bodies support
  Markdown-style formatting — headings, bold/italic/strikethrough, links,
  images, quotes, lists, and code blocks — with a toolbar and live preview
  in the composer, so posts can read like full blog entries.
- **Home page:** trending feed (engagement score with time decay) +
  newest posts + board directory.
- **Profiles:** avatar upload, bio, tagline, accent color, and banner decor
  patterns (grid / stars / waves / circuit / static).
- **Follows & notifications:** follow other members from their profile;
  the Activity page has a Notifications tab (likes, comments, follows,
  badge awards, with an unread counter in the nav) and a Following tab
  showing the latest posts from people you follow.
- **Badges:** admins define badges (name, icon, color, description) with
  an auto-award condition — posts made, comments made, likes received,
  followers, or days since joining. Badges are granted automatically,
  retroactively for existing members, and shown on profiles.

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
