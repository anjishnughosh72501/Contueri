# Contueri 🍿🛋️✨

A virtual hangout lounge where friends join a 6-character room, sit in a curved 3D cinema lounge, watch videos in sync, browse the web together, react with floating emojis, queue up media, play mini-games, and chat in real-time. Built to stay 100% on **Cloudflare's free tier** (Cloudflare Pages + Cloudflare Workers with SQLite Durable Objects).

---

## ✨ Features

- **Curved 3D Hangout Lounge**:
  - Realistic curved 3D rows of cinema seats facing the screen with soft ambient glow.
  - Avatars "sit" in the chairs; empty seats can be claimed with one click.
  - Seated members can stand up to mingle in the standing room strip; seats never shift when others leave.
  - Speech bubbles appear above a member's seat when they chat.
- **Custom Identity & Takeover**:
  - Choose from 24 playful avatars and 8 custom colors, or click `🎲 Pokémon` / `✨ Surprise`.
  - Reconnects and multiple tabs with the same client ID cleanly inherit their seat without ghost duplicates.
- **Floating Reactions & Emotes**:
  - Float emojis (`🔥`, `😂`, `😭`, `👏`, `😮`, `❤️`, `🍿`, `👀`) up the screen using keyboard shortcuts `1`–`8` or the toolbar.
  - Nudge and send seat emotes directly to friends: Wave 👋, Pass Popcorn 🍿, High-five ✋, Dance 💃, Shush 🤫.
- **Ready Check & 3-2-1 Countdown**:
  - Start a synchronized ready check; when everyone is ready, a 3-2-1 countdown overlay counts down to start playback together.
- **Collaborative Queue**:
  - Add YouTube links, direct MP4s, or web pages to the party queue.
  - Upvote favorite videos; items re-sort automatically by votes.
  - Automatically advances to the next top-voted video when the current one ends.
- **Mini-Games & Activities**:
  - **Polls / "Would You Rather"**: Preset party prompts and custom polls with live percentage bars.
  - **Tic-Tac-Toe**: Turn-based multiplayer game with rematch support.
  - **Shared Whiteboard**: Live collaborative drawing board with color palette and client-side PNG export.
- **Atmosphere & Themes**:
  - 4 immersive themes: `🎬 Cinema`, `🛋️ Living Room`, `🔥 Campfire`, `🌃 Rooftop`.
  - **Dim the Lights (Focus Mode)**: Local focus mode darkens the surroundings and enlarges the video (`Esc` to exit).
  - **Shared Popcorn Bucket**: A collective popcorn clicker tracking how much popcorn the lounge has consumed.
  - **Voice Lounge**: 1-click Jitsi Meet voice room integration (`meet.jit.si/contueri-<ROOM>`).
- **Mobile First & Accessible**:
  - Responsive layout below 900px with bottom sheet navigation.
  - Visible keyboard focus rings across all interactive elements, `aria-live="polite"` regions, and `prefers-reduced-motion` compliance.

---

## 🏛️ Architecture & Component Layout

```
Contueri/
├── shared/                   # Shared TypeScript protocol, types, constants & validators
│   └── src/index.ts          # Member, ClientMessage, ServerMessage, QueueItem, RoomMeta, etc.
├── worker/                   # Cloudflare Worker & SQLite Durable Object
│   ├── src/index.ts          # RoomDO, WebSocket Hibernation API, rate limiters, proxy
│   ├── src/ssrf.ts           # SSRF protection: blocks private IPs, metadata, loopback, non-std ports
│   ├── src/games.ts          # Pure logic for Tic-Tac-Toe, Polls
│   └── wrangler.toml         # Durable Object binding & migrations
├── web/                      # React 18 + Vite + TypeScript frontend
│   ├── src/
│   │   ├── App.tsx           # Route controller (Home | JoinPrompt | Room)
│   │   ├── hooks/            # useRoomSocket: connection, clock offset, ping/pong, typed senders
│   │   ├── state/            # roomReducer: state container for members, queue, activity, chat
│   │   ├── components/       # Header, Screen, Lounge, Seat, ReactionBar, Sidebar, etc.
│   │   └── styles/           # CSS modules: tokens, base, home, room, lounge, chat, themes
└── scripts/tests/            # Automated E2E verification test suite
```

---

## 💾 State Persistence Model

To guarantee zero idle execution costs and prevent unbounded storage growth on Cloudflare Workers free tier:

| State Element | Storage Tier | Behavior |
| :--- | :--- | :--- |
| **Room Playback State** | Durable Object SQLite | Persisted (`room_state`); syncs video URL, position, playing state. |
| **Chat History** | Durable Object SQLite | Persisted (`chat_history`), capped at the last 50 messages. |
| **Video Queue** | Durable Object SQLite | Persisted (`queue`), capped at 20 items. |
| **Room Meta** | Durable Object SQLite | Persisted (`room_meta`): name, theme, popcorn count, voice URL. |
| **Active Poll / Tic-Tac-Toe** | Durable Object SQLite | Persisted (`activity_state`); single active game state. |
| **Floating Reactions** | **Broadcast Only** | Ephemeral, dropped after 2.5s; never stored in DO. |
| **Seat Emotes & Nudges** | **Broadcast Only** | Ephemeral, triggers seat animations & ticker lines; never stored. |
| **Typing Indicators** | **Broadcast Only** | Ephemeral, cleared after 2s idle. |
| **Whiteboard Strokes** | **Broadcast Only** | Ephemeral live broadcast (Save as PNG locally). |
| **Activity Ticker** | **Broadcast Only** | Ephemeral last-3-lines ticker with aria-live="polite". |

---

## 💰 Free-Tier Budget & Limits

1. **Cloudflare Workers & Durable Objects**:
   - 100,000 requests/day included on the free tier.
   - **WebSocket Hibernation API**: Sockets sleep in memory at 0 compute cost while waiting for events.
   - **SQLite Storage**: Free tier includes 5 GB of DO storage (Contueri uses < 10 KB per room).
2. **Cloudflare Pages**:
   - Unlimited requests and bandwidth for frontend assets.
3. **SSRF Guard**:
   - `/api/proxy` protects against SSRF attacks by blocking loopback, private RFC 1918, link-local, cloud metadata (`169.254.169.254`), and non-standard ports.

---

## 🛠️ Local Development

### 1. Prerequisites
- **Node.js 20+** and **npm 10+**
- **Python 3.8+** (for `start.py`)

### 2. Install & Build
```bash
npm install
npm run build
```

### 3. Run Locally (All-in-One)
```bash
python start.py
```
- **Frontend**: http://localhost:5173
- **Backend Worker**: http://localhost:8787

Press `Ctrl+C` in your terminal to cleanly terminate both processes.

---

## 🧪 Automated Testing

Contueri includes an end-to-end test suite that verifies the WebSocket protocol, rate limiters, seat switching, identity takeover, and SSRF blocking against a live server:

```bash
npm run test:e2e
```

Tests included:
- `01-identity-and-seats.mjs`: Welcome messages, seat allocation, duplicate client identity takeover (code 4000), seat slide & stand up.
- `02-reactions-and-activity.mjs`: Floating reactions (lane assignment), rate limiting, emotes, activity ticker events.
- `03-ready-check-and-queue.mjs`: Ready check countdown timing (3-2-1 startAt), queue addition, vote sorting, auto-advance on video end.
- `04-polls-and-games.mjs`: Poll creation, voting (1 per client), Tic-Tac-Toe turn enforcement, win/draw detection, board reset.
- `05-proxy-ssrf.mjs`: SSRF blocking for loopback, private ranges, metadata IPs, internal domains, and non-standard ports.

For manual browser testing, refer to [docs/QA.md](docs/QA.md).

---

## 🚀 Deployment Guide

### Step 1: Deploy Worker (Cloudflare Workers)
```bash
cd worker
npx wrangler login
npm run deploy
```
*Note the deployed URL (e.g. `https://contueri-worker.<your-subdomain>.workers.dev`).*

### Step 2: Deploy Frontend (Cloudflare Pages)
```bash
cd ../web
npm run build
npx wrangler pages deploy dist --project-name contueri
```
In your **Cloudflare Dashboard** under Pages project settings, add the environment variable:
- `VITE_WORKER_URL = https://contueri-worker.<your-subdomain>.workers.dev`

---

## 📜 CHANGELOG

- **Phase 0 (Foundation & Hardening)**:
  - Refactored monolith `App.tsx` into modular architecture (`useRoomSocket`, `roomReducer`, component tree, CSS tokens).
  - Implemented stable client IDs (`ct_client_id`) with socket takeover (close code 4000) and seat inheritance.
  - Hardened `/api/proxy` against SSRF, loopback, private IPs, and non-standard ports.
- **Phase 1 (Lounge & Seating)**:
  - Added curved 3D cinema seating rows with chair silhouettes and custom avatar color palettes.
  - Implemented server-owned seats, seat switching, standing room overflow, and temporary speech bubbles above seats.
- **Phase 2 (Interactions & Sync)**:
  - Added floating reactions with keyboard shortcuts `1`–`8` and client/server rate-limiting.
  - Added seat emotes, typing indicators, unread chat badge, and live activity ticker.
  - Implemented ready check with 3-2-1 countdown overlay and collaborative video queue with vote sorting.
- **Phase 3 (Hangout Activities)**:
  - Added "Would You Rather" & custom poll creator with real-time percentage bars.
  - Added multiplayer Tic-Tac-Toe and live whiteboard drawing with PNG export.
- **Phase 4 (Atmosphere & Themes)**:
  - Added 4 themes (`cinema`, `living-room`, `campfire`, `rooftop`) and Focus Mode (`Esc` to exit).
  - Added shared popcorn bucket counter and Jitsi voice lounge link.
- **Phase 5 (Home & Mobile)**:
  - Added 6-box room code input with auto-advance and paste support.
  - Added Recent Lounges storage and QR code sharing modal (`qrcode`).
  - Added mobile responsive layout below 900px with bottom sheet tabs.
