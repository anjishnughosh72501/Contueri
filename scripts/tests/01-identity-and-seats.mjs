import assert from 'node:assert';
import WebSocket from 'ws';

const WORKER_BASE = process.env.WORKER_URL || 'http://127.0.0.1:8787';

async function createRoom() {
  const res = await fetch(`${WORKER_BASE}/api/rooms`, { method: 'POST' });
  assert.strictEqual(res.status, 200);
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
  console.log('🧪 Testing Identity Takeover & Seats on', WORKER_BASE);

  const code = await createRoom();
  console.log(`  ✓ Created room ${code}`);

  const clientId = 'client-test-id-123';
  const ws1 = connectWs(code);

  await new Promise((resolve, reject) => {
    ws1.on('open', resolve);
    ws1.on('error', reject);
  });

  // Join as Pikachu
  ws1.send(JSON.stringify({
    type: 'join',
    clientId,
    nickname: 'Pikachu-01',
    avatar: '🦊',
    color: '#6366f1',
  }));

  const welcome1 = await waitForMessage(ws1, (m) => m.type === 'welcome');
  assert.strictEqual(welcome1.type, 'welcome');
  assert.ok(welcome1.selfId, 'Must receive selfId');
  assert.strictEqual(welcome1.member.seat, 0, 'First joiner should get seat 0');
  console.log(`  ✓ Socket 1 welcomed with selfId: ${welcome1.selfId}, seat: ${welcome1.member.seat}`);

  // Now connect a second socket with the SAME clientId (identity takeover)
  const ws2 = connectWs(code);
  await new Promise((resolve, reject) => {
    ws2.on('open', resolve);
    ws2.on('error', reject);
  });

  let ws1CloseCode = null;
  let ws1CloseReason = '';
  ws1.on('close', (closeCode, reason) => {
    ws1CloseCode = closeCode;
    ws1CloseReason = reason.toString();
  });

  ws2.send(JSON.stringify({
    type: 'join',
    clientId,
    nickname: 'Pikachu-01',
    avatar: '🦊',
    color: '#6366f1',
  }));

  const welcome2 = await waitForMessage(ws2, (m) => m.type === 'welcome');
  assert.ok(welcome2.selfId, 'Socket 2 must receive selfId');
  assert.strictEqual(welcome2.member.seat, 0, 'Socket 2 should inherit seat 0 from replaced socket');
  console.log(`  ✓ Socket 2 welcomed with inherited seat: ${welcome2.member.seat}`);

  // Wait briefly for ws1 close event
  await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(ws1CloseCode, 4000, `Expected close code 4000 for replaced socket, got ${ws1CloseCode}`);
  assert.strictEqual(ws1CloseReason, 'replaced');
  console.log(`  ✓ Socket 1 closed with code 4000 (reason: replaced)`);

  // Test sitting in seat 5
  ws2.send(JSON.stringify({ type: 'sit', seat: 5 }));
  const membersMsg = await waitForMessage(ws2, (m) => m.type === 'members' && m.members.some((x) => x.seat === 5));
  assert.ok(membersMsg, 'Should receive members with updated seat 5');
  console.log('  ✓ Member moved to seat 5');

  // Test standing
  ws2.send(JSON.stringify({ type: 'stand' }));
  const standMsg = await waitForMessage(ws2, (m) => m.type === 'members' && m.members.some((x) => x.seat === null));
  assert.ok(standMsg, 'Should receive members with standing member');
  console.log('  ✓ Member stood up (seat: null)');

  ws2.close();
  console.log('✅ Identity takeover & seats passed successfully!\n');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
