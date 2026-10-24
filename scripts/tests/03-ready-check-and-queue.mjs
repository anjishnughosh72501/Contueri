import assert from 'node:assert';
import WebSocket from 'ws';

const WORKER_BASE = process.env.WORKER_URL || 'http://127.0.0.1:8787';

async function createRoom() {
  const res = await fetch(`${WORKER_BASE}/api/rooms`, { method: 'POST' });
  const data = await res.json();
  return data.code;
}

function connectWs(code) {
  const wsUrl = WORKER_BASE.replace(/^http/, 'ws') + `/api/rooms/${code}/ws`;
  return new WebSocket(wsUrl);
}

function waitForMessage(ws, predicate, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for message after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (predicate(msg)) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(msg);
        }
      } catch {}
    };
    ws.on('message', handler);
  });
}

async function run() {
  console.log('🧪 Testing Ready Check, Countdown & Queue on', WORKER_BASE);

  const code = await createRoom();
  const ws1 = connectWs(code);
  const ws2 = connectWs(code);

  await Promise.all([
    new Promise((r) => ws1.on('open', r)),
    new Promise((r) => ws2.on('open', r)),
  ]);

  ws1.send(JSON.stringify({ type: 'join', clientId: 'c1', nickname: 'Gengar-88' }));
  ws2.send(JSON.stringify({ type: 'join', clientId: 'c2', nickname: 'Lucario-99' }));

  await Promise.all([
    waitForMessage(ws1, (m) => m.type === 'welcome'),
    waitForMessage(ws2, (m) => m.type === 'welcome'),
  ]);

  // 1. Ready Check flow
  ws1.send(JSON.stringify({ type: 'readyCheckStart' }));
  const rcStart = await waitForMessage(ws2, (m) => m.type === 'readyCheck' && m.phase === 'checking');
  assert.strictEqual(rcStart.phase, 'checking');
  console.log('  ✓ Ready check started (phase: checking)');

  // ws2 marks ready -> everyone is ready!
  ws2.send(JSON.stringify({ type: 'ready', ready: true }));
  const countdownMsg = await waitForMessage(ws1, (m) => m.type === 'readyCheck' && m.phase === 'countdown');
  assert.strictEqual(countdownMsg.phase, 'countdown');
  assert.ok(countdownMsg.startAt && countdownMsg.startAt > Date.now(), 'startAt must be in the future (~3s)');
  console.log(`  ✓ All members ready -> countdown phase triggered with startAt: ${countdownMsg.startAt}`);

  // 2. Queue flow
  ws1.send(JSON.stringify({ type: 'queueAdd', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' }));
  const qMsg1 = await waitForMessage(ws2, (m) => m.type === 'queue' && m.items.length === 1);
  assert.strictEqual(qMsg1.items.length, 1);
  const itemId = qMsg1.items[0].id;
  assert.strictEqual(qMsg1.items[0].voters.length, 1);
  console.log('  ✓ Video added to queue');

  // ws2 votes for the video
  ws2.send(JSON.stringify({ type: 'queueVote', itemId }));
  const qMsg2 = await waitForMessage(ws1, (m) => m.type === 'queue' && m.items[0]?.voters.length === 2);
  assert.strictEqual(qMsg2.items[0].voters.length, 2);
  console.log('  ✓ Vote recorded (2 votes)');

  // 3. Play next from queue
  ws1.send(JSON.stringify({ type: 'queuePlayNext' }));
  const stateMsg = await waitForMessage(ws2, (m) => m.type === 'state' && m.videoId === 'aqz-KE-bpKQ');
  assert.strictEqual(stateMsg.videoId, 'aqz-KE-bpKQ');
  assert.strictEqual(stateMsg.isPlaying, true);
  console.log('  ✓ Queue item automatically loaded and playing');

  ws1.close();
  ws2.close();
  console.log('✅ Ready check, countdown & queue verified successfully!\n');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
