#!/usr/bin/env node
/** Run the prototype's pure rules without adding a test-framework dependency. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = path.join(root, 'apps/client');
const output = mkdtempSync(path.join(tmpdir(), 'tong-seoul-check-'));
try {
  const compiled = spawnSync(process.execPath, [
    path.join(client, 'node_modules/typescript/bin/tsc'),
    '--target', 'ES2022', '--module', 'commonjs', '--moduleResolution', 'node',
    '--strict', '--skipLibCheck', '--esModuleInterop', '--outDir', output,
    path.join(client, 'lib/seoul-adventure/progress.test.ts'),
  ], { cwd: client, stdio: 'inherit' });
  if (compiled.status !== 0) process.exitCode = compiled.status ?? 1;
  else {
    const checked = spawnSync(process.execPath, ['--test', path.join(output, 'progress.test.js')], {
      cwd: root, stdio: 'inherit',
    });
    process.exitCode = checked.status ?? 1;
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}
