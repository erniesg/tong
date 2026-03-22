#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_PATH = process.env.TONG_SERVER_LOG || '/tmp/tong-server.log';
const SERVER_PATTERN = process.env.TONG_SERVER_PGREP_PATTERN || 'node --watch src/index.mjs|node src/index.mjs';
const SERVER_CWD = process.env.TONG_SERVER_CWD || path.resolve(__dirname, '..');
const SERVER_START_COMMAND = (process.env.TONG_SERVER_START_COMMAND || 'npm run dev:server').trim();

function listServerPids() {
  try {
    return execSync(`pgrep -f "${SERVER_PATTERN}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: '/bin/bash',
    })
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value !== process.pid);
  } catch {
    return [];
  }
}

for (const pid of listServerPids()) {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {}
}

fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
const logFd = fs.openSync(LOG_PATH, 'a');
const child = spawn('bash', ['-lc', SERVER_START_COMMAND], {
  cwd: SERVER_CWD,
  detached: true,
  stdio: ['ignore', logFd, logFd],
});
child.unref();
fs.closeSync(logFd);

console.log(JSON.stringify({ restarted: true, logPath: LOG_PATH, cwd: SERVER_CWD }));
