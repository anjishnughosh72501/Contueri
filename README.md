# Contueri 🍿🎬

Friends in different places join a shared room, watch videos in sync, browse websites together, and chat in real-time. Built entirely on free tiers: Cloudflare Pages (frontend) and Cloudflare Worker with SQLite-backed Durable Objects (backend).

---

## ✨ Features

- **Virtual Cinema Theater & Lounge**:
  - Interactive seating grid with fun avatars (`🍿`, `🥤`, `🎬`, `🦊`, `🐼`, `🚀`).
  - Friends are seated dynamically; click any empty seat to switch spots in real-time.
- **Auto Pokémon Guest Nicknames**:
  - Users without a chosen nickname are automatically assigned a Pokémon name (e.g., `Pikachu-42`, `Gengar-88`).
  - Includes a `🎲 Roll Pokémon` generator button on the home screen.
- **Smart Room Codes**:
  - Room codes are sanitized on input—spaces are automatically stripped and never count toward the 6-character room code.
  - Deep linking support: share `http://your-domain/r/ABC123` to invite friends directly.
- **Multi-Media Synchronization**:
  - **YouTube Videos**: Full sync (play, pause, seek) with drift correction and remote echo protection via the YouTube IFrame API.
  - **Direct MP4 / WebM Files**: HTML5 video sync with metadata race handling and automated range/CORS proxy fallback.
  - **Mini Browser**: Synchronized in-theater web browser that proxies arbitrary URLs, strips restrictive `X-Frame-Options` and CSP headers, and injects `<base>` tags to render websites side-by-side.
- **Real-Time Room Chat**:
  - Instant messaging with separate styling for your messages, friend messages, and system notifications (joins/leaves).
  - Last 50 messages replayed instantly to late joiners.
  - Built-in rate limiting (max 5 messages per 5 seconds per user) to protect against spam.
- **Zero Idle Cost Architecture**:
  - Powered by Cloudflare Workers Durable Objects **WebSocket Hibernation API**—idle connections incur 0 wall-clock compute execution cost.

---

## 🏛️ Architecture

- **/shared**: TypeScript types, protocol messages (`ClientMessage`, `ServerMessage`), nickname generator, room code sanitizer, and URL parser shared across packages.
- **/worker**: Cloudflare Worker with `RoomDO` (SQLite Durable Object) handling room creation, WebSocket connections, hibernation state, chat replay, and `/api/proxy`.
- **/web**: React 18 + Vite + TypeScript frontend with the virtual cinema lounge, YouTube/HTML5/mini-browser player, and chat drawer.
- **start.py**: All-in-one local launcher that compiles shared code and starts both backend and frontend concurrently with color-coded logs.

---

## 💰 Free-Tier Limits to Watch

1. **Cloudflare Workers & Durable Objects**:
   - Free tier includes **100,000 requests/day**.
   - **WebSocket Hibernation API**: Sockets hibernate in memory while waiting for messages. Wall-clock execution time is only billed during active message dispatch.
   - **SQLite DO Storage**: Free tier includes **5 GB** of DO storage (our room metadata is <1 KB per room).
2. **Cloudflare Pages**:
   - **Unlimited requests** and bandwidth on the free tier.
   - Static asset hosting with automatic edge caching.
3. **YouTube IFrame API**:
   - Zero quota cost; runs directly inside the client's browser.

---

## 🛠️ Local Development

### 1. Prerequisites
- **Node.js 20+** and **npm 10+**
- **Python 3.8+** (for `start.py`)

### 2. Install Dependencies
```bash
npm install
```

### 3. Build the Shared Package
```bash
npm run build:shared
```

### 4. Start Local Development (All-in-One)
```bash
python start.py
```
This builds `@contueri/shared` and boots:
- **Backend Worker**: `http://127.0.0.1:8787`
- **Frontend App**: `http://localhost:5173`

Press `Ctrl+C` in your terminal to cleanly terminate both processes.

---

## 🚀 Deployment Guide

### Step 1: Deploy Backend (Cloudflare Worker)

1. Log in to Cloudflare:
   ```bash
   npx wrangler login
   ```
2. Deploy the Worker:
   ```bash
   cd worker
   npm run deploy
   ```
3. Note the deployed Worker URL in the terminal output, for example:
   ```
   https://contueri-worker.<your-subdomain>.workers.dev
   ```

### Step 2: Deploy Frontend (Cloudflare Pages)

1. Build the frontend with the Worker URL configured:
   ```bash
   cd ../web
   npm run build
   ```
2. Deploy to Cloudflare Pages:
   ```bash
   npx wrangler pages deploy dist --project-name contueri
   ```
3. Set the environment variable in Cloudflare Pages:
   - In your Cloudflare Dashboard, go to **Workers & Pages** > **contueri** > **Settings** > **Environment variables**.
   - Add variable: `VITE_WORKER_URL = https://contueri-worker.<your-subdomain>.workers.dev`.
   - Client-side routing is pre-configured via `web/public/_redirects` (`/* /index.html 200`), so direct links like `/r/:code` work smoothly on page refreshes.

---

## 🧪 Testing

Comprehensive test scripts are available in the root directory:
- `node test-stage1.mjs`: Tests DO ping/pong echo over WebSocket.
- `node test-stage2.mjs`: Tests room creation, join flow, and member lists.
- `node test-stage3.mjs`: Tests chat broadcast, 50-message replay, and rate-limiting.
- `node test-stage4.mjs`: Tests `setVideo` synchronization and state persistence.
- `node test-stage5.mjs`: Tests play, pause, seek, and drift correction events.
- `node test-proxy-and-browser.mjs`: Tests range header streaming and web page proxying.
