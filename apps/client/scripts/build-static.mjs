#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const clientRoot = process.cwd();

const staticBuildExclusions = [
  {
    source: path.join(clientRoot, 'app', 'api'),
    parked: path.join(clientRoot, 'app', '__api_ssr_only__'),
  },
  {
    source: path.join(clientRoot, 'app', 'playtest', '[id]'),
    parked: path.join(clientRoot, 'app', 'playtest', '__id_ssr_only__'),
  },
];

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: clientRoot,
      stdio: 'inherit',
      env,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function parkRouteForStaticBuild(entry) {
  if (!(await exists(entry.source))) return false;
  if (await exists(entry.parked)) {
    throw new Error(`Static build staging path already exists: ${entry.parked}`);
  }
  await fs.rename(entry.source, entry.parked);
  return true;
}

async function restoreRouteAfterBuild(entry, wasParked) {
  if (!wasParked) return;
  if (await exists(entry.source)) {
    throw new Error(`Cannot restore staged path because destination already exists: ${entry.source}`);
  }
  await fs.rename(entry.parked, entry.source);
}

const env = {
  ...process.env,
  TONG_BUILD_MODE: 'static-export',
};

const parked = [];
try {
  for (const entry of staticBuildExclusions) {
    const wasParked = await parkRouteForStaticBuild(entry);
    parked.push({ entry, wasParked });
  }

  await run('npm', ['run', 'ds:build'], env);
  await run('npx', ['next', 'build'], env);
} finally {
  for (const { entry, wasParked } of parked.reverse()) {
    await restoreRouteAfterBuild(entry, wasParked);
  }
}
