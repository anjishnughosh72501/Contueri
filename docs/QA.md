# Contueri Manual QA Checklist & Verification Guide

This checklist guides manual verification of Contueri's virtual hangout lounge across browsers, viewports, accessibility settings, and load scenarios.

---

## 1. Setup & Environments

- [ ] **Dual Desktop Viewports**:
  - Browser A: Chrome/Brave (Desktop, 1440x900)
  - Browser B: Firefox/Edge or Incognito Window (Desktop, 1440x900)
- [ ] **Mobile Viewport**:
  - Chrome DevTools Device Mode set to iPhone 14 / Pixel 7 (< 900px width)
- [ ] **Local Server**:
  - Run `python start.py`
  - Frontend: `http://localhost:5173`
  - Backend: `http://localhost:8787`

---

## 2. Room Flow & Identity Continuity

- [ ] **Create Room**:
  - From the landing page, click `✨ Create a New Lounge`.
  - Verify auto-redirection to `/r/:code` with a 6-character room code.
  - Verify that the room code is added to the "Recent Lounges" on the home page.
- [ ] **Customized Identity**:
  - Change avatar, nickname, and color palette.
  - Verify that chosen appearance is reflected in the lounge.
  - Click `🎲 Pokémon` to roll a new name; click `✨ Surprise` to randomize all three.
- [ ] **Deep Linking & Join Prompt**:
  - Copy room invite link and open in Browser B.
  - Verify the `JoinPrompt` appears, displaying the room code and avatar customizer.
  - Click `🎬 Enter Lounge` and verify successful entry.
- [ ] **Identity Takeover & Reconnect**:
  - Open a second tab in Browser A with the same room URL (`/r/:code`).
  - Verify that the old tab's socket is closed cleanly (`reason: replaced`) without showing a "left" system message.
  - Verify that the new tab inherits the exact same seat.

---

## 3. Lounge & Seating Mechanics

- [ ] **Curved 3D Seating Grid**:
  - Verify 3 rows of seats (Back: 1–4, Middle: 5–8, Front: 9–12) with 3D tilt.
  - Verify that the user's seat displays a green `YOU` indicator.
- [ ] **Seat Switching & Standing**:
  - Click an empty seat; verify that you slide/move to that seat.
  - Click `Stand Up`; verify that you move to the "Standing" strip at the bottom.
  - Click an empty seat while standing; verify that you sit back down.
- [ ] **Capacity & Overflow (12+ Members)**:
  - When 12 seats are occupied, additional joiners automatically appear in the "Standing" area with full chat/interaction capabilities.
  - When a seated member leaves, their seat becomes empty and available for anyone to claim.
- [ ] **Seat Speech Bubbles**:
  - Type a chat message.
  - Verify that a speech bubble pops up over the sender's seat and disappears after ~4 seconds.

---

## 4. Real-time Interactions & Atmosphere

- [ ] **Floating Reactions**:
  - Click emojis on the reaction bar or press keys `1`–`8`.
  - Verify that emoji floats up from the bottom of the screen with a sway effect across all connected clients.
  - Spam reaction buttons; verify client-side throttle (~4/sec).
- [ ] **Seat Emotes**:
  - Click another friend's seat to open the emote menu (Wave, Popcorn, High-five, Dance, Shush).
  - Select an emote; verify that both sender and target seats animate and an activity ticker line is broadcast.
- [ ] **Shared Popcorn Bucket**:
  - Click `🍿 Eat Popcorn`.
  - Verify that the shared room counter increments across all clients.
- [ ] **Themes**:
  - Open `⚙️ Settings` and select each theme: `🎬 Cinema`, `🛋️ Living Room`, `🔥 Campfire`, `🌃 Rooftop`.
  - Verify that background hues, accents, and glows update immediately.
- [ ] **Focus Mode (Dim the Lights)**:
  - Click `🌙 Dim Lights`.
  - Verify that the room background darkens, the screen expands, and the lounge shrinks.
  - Press `Esc`; verify that focus mode exits.
- [ ] **Voice Lounge**:
  - Click `🎧 Join Voice`; verify that Jitsi Meet opens in a new tab (`https://meet.jit.si/contueri-<CODE>`).

---

## 5. Playback Sync & Video Queue

- [ ] **Ready Check & 3-2-1 Countdown**:
  - Click `⏱️ Ready Check`.
  - All users see the ready prompt; click `I'm Ready!`.
  - When all present members are ready, verify the 3-2-1 countdown overlay appears on the screen and video plays in sync upon reaching 0.
- [ ] **Video Queue & Upvoting**:
  - In the `📋 Queue` tab, paste a YouTube link or MP4 link and click `+ Add`.
  - From Browser B, click the `▲` upvote button; verify vote count increases and items re-sort by vote count.
  - Click `▶ Play Next Now`; verify the top-voted video loads on the screen.
  - When a video ends, verify the queue auto-advances to the next item.

---

## 6. Mini Games & Activities

- [ ] **Polls ("Would You Rather")**:
  - In the `🎯 Activities` tab, pick a preset prompt or create a custom poll.
  - Friends vote; verify that percentage bars update in real time.
  - Click `Close Poll`.
- [ ] **Tic-Tac-Toe**:
  - Member A clicks `Play as X`; Member B clicks `Play as O`.
  - Play moves alternately; verify turn enforcement, win/draw detection, and `↻ New Game` rematch.
- [ ] **Shared Whiteboard**:
  - Draw strokes on the canvas; verify that drawings replicate on other clients.
  - Click `Clear` to reset; click `Save PNG` to download the artwork as a PNG file.

---

## 7. Accessibility & Mobile

- [ ] **Keyboard Navigation**:
  - Tab through all controls with visible focus rings.
  - Activate buttons with `Enter` and `Space`.
- [ ] **Screen Readers**:
  - Chat and activity ticker contain `aria-live="polite"`.
  - Emoji buttons contain descriptive `aria-label`s.
- [ ] **Reduced Motion (`prefers-reduced-motion`)**:
  - Enable reduced motion in OS/browser.
  - Verify floating reactions fade in place without travel animation, and speech bubbles do not bounce.
- [ ] **Mobile Viewport (< 900px)**:
  - Verify video stays on top, followed by the horizontal scrollable lounge strip.
  - Verify sidebar functions smoothly on mobile screens with touch-friendly tap targets (>= 44px).
