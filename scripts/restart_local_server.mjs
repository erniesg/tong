#!/usr/bin/env node

import fs from 'node:fs';
import { execSync, spawn } from 'node:child_process';

const LOG_PATH = process.env.TONG_SERVER_LOG || '/tmp/tong-server.log';
const SERVER_PATTERN = process.env.TONG_SERVER_PGREP_PATTERN || 'node --watch src/index.mjs|node src/index.mjs';

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

fs.mkdirSync(LOG_PATH.replace(/\/[^/]+$/, ''), { recursive: true });
const logFd = fs.openSync(LOG_PATH, 'a');
const child = spawn('bash', ['-lc', 'cd /workspace/tong && npm run dev:server'], {
  detached: true,
  stdio: ['ignore', logFd, logFd],
});
child.unref();
fs.closeSync(logFd);

console.log(JSON.stringify({ restarted: true, logPath: LOG_PATH }));
