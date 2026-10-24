import assert from 'node:assert';

const WORKER_BASE = process.env.WORKER_URL || 'http://127.0.0.1:8787';

const BLOCKED_URLS = [
  'http://127.0.0.1',
  'http://localhost',
  'http://localhost:8787',
  'http://169.254.169.254/latest/meta-data/',
  'http://10.0.0.1:80',
  'http://192.168.1.1',
  'http://172.16.0.1',
  'http://my-service.internal',
  'http://printer.local',
  'http://example.com:8080',
  'http://example.com:22',
  'http://[::1]',
];

async function run() {
  console.log('🧪 Testing Proxy SSRF Protection on', WORKER_BASE);

  for (const target of BLOCKED_URLS) {
    const proxyUrl = `${WORKER_BASE}/api/proxy?url=${encodeURIComponent(target)}`;
    try {
      const res = await fetch(proxyUrl);
      assert.strictEqual(
        res.status,
        403,
        `Expected HTTP 403 for blocked target ${target}, but got ${res.status}`
      );
      const data = await res.json();
      assert(data.error && data.error.includes('blocked'), `Error message missing blocked text for ${target}`);
      console.log(`  ✓ Blocked: ${target} -> 403 Forbidden`);
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        console.error('❌ Connection refused to Worker. Ensure wrangler dev is running on port 8787.');
        process.exit(1);
      }
      throw err;
    }
  }

  console.log('✅ SSRF protection verified successfully!\n');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
