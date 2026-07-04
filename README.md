# Luciola Listen

A self-hostable **listen-together** music web app with a built-in **AI companion**.
Play music, listen in sync with friends, switch themes, and chat with an AI that listens along —
all powered by *your own* audio and AI key, configured from the UI.

## Features

- **Real audio playback** — play/pause, seek, prev/next, live progress, play modes (loop/one/shuffle), background-safe track prefetch so lock-screen playback keeps going
- **Listen together** — share a room; play / pause / seek / track changes sync in real time (WebSocket); share songs into the room chat as cards
- **AI companion** — chats along, can DJ (play/switch/share songs via inline actions), wired to *your* OpenAI-compatible endpoint; pull the model list from your endpoint in Settings
- **NetEase Cloud Music integration** — QR login, playlists, search, daily recommendations, personal FM, lyrics **with translation toggle**, artist pages, likes, batch playlist editing (multi-select play / queue / save / delete)
- **Add your own songs** — paste a direct audio URL under Library → Local
- **Themes & customization** — five built-in skins + full custom palette, dark mode, wallpaper, per-surface opacity & blur (nav bar, cards, room chrome, chat bubbles), draggable floating ball
- **Lyric niceties** — swipe-to-seek with snap line, four lyric fonts (bundled open-source KaiTi & rounded webfonts), adjustable size
- **Installable PWA** — manifest + icons, media-session lock-screen controls
- Ships **empty of private data** — `data/` is gitignored; bring your own songs, key, and content

## Quick start

```bash
npm install
npm start
```

Open **http://localhost:4183/pkg/index.html** (change port with `PORT=8080 npm start`).

## Listen together

Everyone opening the same server shares room `main` by default; add `?room=yourcode` to the URL
for a private room and share that link. Playback syncs in real time across the room.

## Configure your AI

Open the **Together** tab (bottom nav) → **Model settings** → fill in your OpenAI-compatible
**endpoint** + **API key** → hit **Pull models** and pick one → optionally write a **persona
prompt** → Save. Keys entered in the UI live in your browser's localStorage and are only sent to
your own server, which forwards them to your endpoint.

You can also set a server-wide default in `data/settings.json` (`ai.base_url` / `ai.api_key` /
`ai.model`). The stored key is never returned by the API — `GET /api/settings` masks it — and
`data/` is gitignored, so nothing private ships with the repo.

## How it works

- **Frontend** (`frontend/pkg/`): the listen app (React 18 + Babel from local `vendor/`), plus small
  bridges that wire the app to real backends — `player-engine`-style audio inside the app, `sync.js`
  (real-time room sync), `claude-bridge.js` (AI → your endpoint), `settings-panel.js` (config).
- **Backend** (`server/index.mjs`): Express + WebSocket. Endpoints: `/api/settings`, `/api/models`,
  `/api/chat`, `/api/song-analysis`, `/ws` (room sync), static files.

## Behind a reverse proxy

Point your proxy at the server (default 4183), serve at your domain root, and **proxy `/ws`** for sync.

## Privacy

No keys, personal data, playlists, or chat logs ship with this project. `data/` is gitignored.

## License

MIT — see LICENSE.
