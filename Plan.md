# Watch Party MVP plan

Oct 24, 2026 · @Rick

The demo is a YouTube-only watch party: friends open a room link, the video plays in sync on every device, and a chat panel sits beside it, all on free tiers.

## Scope

The demo proves one thing: friends in different places can watch the same YouTube video in sync while chatting. Everything else waits.

**In the demo**

- Create a room (get a 6-character code and a share link) or join one by code
- Guest nicknames only, no accounts or passwords
- YouTube videos by pasting a link, with play, pause and seek synced for everyone
- Anyone in the room can control playback (simplest rule for a small test)
- Room chat with the last 50 messages shown to late joiners
- A list of who is in the room
- Works on desktop and mobile browsers

**Left out on purpose**

- Netflix, Prime and other DRM sites (needs the browser extension later)
- Accounts, saved rooms, moderation, voice chat, queues

## Stack and setup

Everything below is free for a friends-sized test. Prices were checked on Oct 24, 2026 and can change.

| Part | Tool | Why | Cost |
| --- | --- | --- | --- |
| Frontend | React + Vite + TypeScript | Fast to start, no server-side rendering needed | Free |
| Frontend hosting | Cloudflare Pages | Free static hosting, same account as the backend | Free |
| Realtime backend | Cloudflare Worker + Durable Objects | One object per room holds state and WebSockets | Free (100,000 requests per day) |
| Video player | YouTube IFrame Player API | Official embed with play, pause, seek and state events | Free |
| Code and deploys | GitHub + Wrangler CLI | Version control and one-command deploy | Free |

One-time setup:

1. Install Node.js 20 or newer and create a free Cloudflare account.
2. Run `npm create vite@latest watchparty -- --template react-ts` for the frontend.
3. Add a `worker/` folder for the backend and set it up with Wrangler.
4. Keep the demo on the free `*.pages.dev` and `*.workers.dev` addresses; buy a domain only after friends like it.
