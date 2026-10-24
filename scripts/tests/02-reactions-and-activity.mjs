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
  console.log('🧪 Testing Reactions, Emotes & Activity on', WORKER_BASE);

  const code = await createRoom();
  const ws1 = connectWs(code);
  const ws2 = connectWs(code);

  await Promise.all([
    new Promise((r) => ws1.on('open', r)),
    new Promise((r) => ws2.on('open', r)),
  ]);

  ws1.send(JSON.stringify({ type: 'join', clientId: 'c1', nickname: 'Charmander-11' }));
  ws2.send(JSON.stringify({ type: 'join', clientId: 'c2', nickname: 'Squirtle-22' }));

  await Promise.all([
    waitForMessage(ws1, (m) => m.type === 'welcome'),
    waitForMessage(ws2, (m) => m.type === 'welcome'),
  ]);

  // 1. Test floating reactions
  ws1.send(JSON.stringify({ type: 'reaction', emoji: '🔥' }));
  const reactMsg = await waitForMessage(ws2, (m) => m.type === 'reaction' && m.emoji === '🔥');
  assert.strictEqual(reactMsg.emoji, '🔥');
  assert.ok(typeof reactMsg.x === 'number' && reactMsg.x >= 0 && reactMsg.x <= 1, 'x must be between 0 and 1');
  console.log(`  ✓ Received reaction 🔥 with lane x=${reactMsg.x}`);

  // 2. Test emote & activity line
  ws1.send(JSON.stringify({ type: 'emote', kind: 'wave' }));
  const emoteMsg = await waitForMessage(ws2, (m) => m.type === 'emote' && m.kind === 'wave');
  assert.strictEqual(emoteMsg.kind, 'wave');
  console.log('  ✓ Received emote wave');

  const actMsg = await waitForMessage(ws2, (m) => m.type === 'activity' && m.text.includes('waved'));
  assert.ok(actMsg.text.includes('waved'), 'Activity line should describe wave');
  console.log(`  ✓ Received activity line: "${actMsg.text}"`);

  // 3. Test play/pause activity line
  ws1.send(JSON.stringify({ type: 'play', positionSec: 15 }));
  const playAct = await waitForMessage(ws2, (m) => m.type === 'activity' && m.text.includes('played at 0:15'));
  assert.ok(playAct.text.includes('played at 0:15'));
  console.log(`  ✓ Play emitted activity: "${playAct.text}"`);

  ws1.close();
  ws2.close();
  console.log('✅ Reactions, emotes & activity verified successfully!\n');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
