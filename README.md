# TORISFORUM ⚡

A cyber/y2k social forum. Boards, posts with attachments, likes, comments,
trending feed, and customizable profiles — all saved to a real backend.

## Run it

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

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
