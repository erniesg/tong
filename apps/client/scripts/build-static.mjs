import { access, rename, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');
const appDir = path.join(clientRoot, 'app');
const apiDir = path.join(appDir, 'api');
const hiddenApiDir = path.join(appDir, '_api-static-disabled');

async function exists(target) {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function run() {
  const hasApiDir = await exists(apiDir);
  const hasHiddenApiDir = await exists(hiddenApiDir);

  if (hasApiDir && hasHiddenApiDir) {
    throw new Error('Both app/api and app/_api-static-disabled exist; refusing to continue.');
  }

  if (hasApiDir) {
    await rename(apiDir, hiddenApiDir);
  }

  try {
    await rm(path.join(clientRoot, '.next'), { recursive: true, force: true });

    await new Promise((resolve, reject) => {
      const child = spawn('next', ['build'], {
        cwd: clientRoot,
        env: {
          ...process.env,
          NEXT_BUILD_TARGET: 'static',
        },
        shell: true,
        stdio: 'inherit',
      });

      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`Static build failed with exit code ${code ?? 'unknown'}`));
      });
      child.on('error', reject);
    });
  } finally {
    if (await exists(hiddenApiDir)) {
      await rename(hiddenApiDir, apiDir);
    }
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
