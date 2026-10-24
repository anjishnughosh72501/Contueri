import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_FILES = [
  '05-proxy-ssrf.mjs',
  '01-identity-and-seats.mjs',
  '02-reactions-and-activity.mjs',
  '03-ready-check-and-queue.mjs',
  '04-polls-and-games.mjs',
];

async function runTest(fileName) {
  const filePath = path.join(__dirname, fileName);
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [filePath], {
      stdio: 'inherit',
      env: process.env,
    });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test ${fileName} exited with code ${code}`));
      }
    });
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 Running Contueri E2E Test Suite');
  console.log('='.repeat(60) + '\n');

  for (const file of TEST_FILES) {
    try {
      await runTest(file);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  console.log('='.repeat(60));
  console.log('🎉 All E2E Tests Passed Successfully!');
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
