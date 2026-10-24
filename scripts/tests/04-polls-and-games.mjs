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
  console.log('🧪 Testing Polls & Games on', WORKER_BASE);

  const code = await createRoom();
  const ws1 = connectWs(code);
  const ws2 = connectWs(code);

  await Promise.all([
    new Promise((r) => ws1.on('open', r)),
    new Promise((r) => ws2.on('open', r)),
  ]);

  ws1.send(JSON.stringify({ type: 'join', clientId: 'c1', nickname: 'Eevee-55' }));
  ws2.send(JSON.stringify({ type: 'join', clientId: 'c2', nickname: 'Snorlax-77' }));

  await Promise.all([
    waitForMessage(ws1, (m) => m.type === 'welcome'),
    waitForMessage(ws2, (m) => m.type === 'welcome'),
  ]);

  // 1. Polls
  ws1.send(JSON.stringify({
    type: 'pollCreate',
    question: 'Favorite Snack?',
    options: ['Popcorn', 'Pizza', 'Candy'],
  }));

  const pollMsg = await waitForMessage(ws2, (m) => m.type === 'activityState' && m.activity.type === 'poll');
  assert.strictEqual(pollMsg.activity.poll.question, 'Favorite Snack?');
  console.log('  ✓ Poll created: "Favorite Snack?"');

  // ws2 votes for Pizza (index 1)
  ws2.send(JSON.stringify({ type: 'pollVote', optionIndex: 1 }));
  const voteMsg = await waitForMessage(ws1, (m) => m.type === 'activityState' && m.activity.poll?.votes['c2'] === 1);
  assert.strictEqual(voteMsg.activity.poll.votes['c2'], 1);
  console.log('  ✓ Poll vote recorded');

  // 2. Tic-Tac-Toe
  ws1.send(JSON.stringify({ type: 'setActivity', activityType: 'tictactoe' }));
  await waitForMessage(ws2, (m) => m.type === 'activityState' && m.activity.type === 'tictactoe');

  ws1.send(JSON.stringify({ type: 'tttJoin', side: 'X' }));
  await waitForMessage(ws2, (m) => m.type === 'activityState' && m.activity.tictactoe?.players.X === 'c1');

  ws2.send(JSON.stringify({ type: 'tttJoin', side: 'O' }));
  await waitForMessage(ws1, (m) => m.type === 'activityState' && m.activity.tictactoe?.players.O === 'c2');
  console.log('  ✓ Tic-Tac-Toe: Players claimed X and O');

  // X moves at index 0 (top-left)
  ws1.send(JSON.stringify({ type: 'tttMove', index: 0 }));
  const move1 = await waitForMessage(ws2, (m) => m.type === 'activityState' && m.activity.tictactoe?.board[0] === 'X');
  assert.strictEqual(move1.activity.tictactoe.turn, 'O');
  console.log('  ✓ Tic-Tac-Toe: Move validated and turn switched to O');

  ws1.close();
  ws2.close();
  console.log('✅ Polls & games verified successfully!\n');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
