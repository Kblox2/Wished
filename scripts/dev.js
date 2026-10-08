import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const vite = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', '5173'], {
  cwd: root,
  stdio: 'inherit',
});
let electron = null;
let stopping = false;

function stopChildren() {
  if (stopping) return;
  stopping = true;
  if (electron && electron.exitCode === null) electron.kill();
  if (vite.exitCode === null) vite.kill();
}

async function waitForVite() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (vite.exitCode !== null) throw new Error(`Vite exited with code ${vite.exitCode}.`);
    try {
      const response = await fetch('http://127.0.0.1:5173', { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error('Vite did not become ready within 40 seconds.');
}

process.once('SIGINT', stopChildren);
process.once('SIGTERM', stopChildren);
vite.once('error', (error) => {
  console.error(`Could not start Vite: ${error.message}`);
  stopChildren();
  process.exitCode = 1;
});
vite.once('exit', (code) => {
  if (!stopping) {
    console.error(`Vite exited unexpectedly with code ${code}.`);
    stopChildren();
    process.exitCode = code || 1;
  }
});

try {
  await waitForVite();
  if (stopping) process.exit(0);
  const electronExecutable = require('electron');
  electron = spawn(electronExecutable, ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, THE_SYSTEM_DEV_SERVER_URL: 'http://127.0.0.1:5173' },
  });
  electron.once('error', (error) => {
    console.error(`Could not start Electron: ${error.message}`);
    stopChildren();
    process.exitCode = 1;
  });
  electron.once('exit', (code) => {
    stopChildren();
    process.exitCode = code || 0;
  });
} catch (error) {
  console.error(error.message);
  stopChildren();
  process.exitCode = 1;
}
