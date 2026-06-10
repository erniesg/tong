import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const repoRoot = process.cwd();
const clientRequire = createRequire(path.join(repoRoot, 'apps/client/package.json'));
const ts = clientRequire('typescript');

const sourcePath = path.join(repoRoot, 'apps/client/lib/playtest/rrweb-recorder.ts');
const source = readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

const posts = [];
const fetchResults = [true, false, true];
let emitEvent;
let stopped = false;

const sandboxRequire = (specifier) => {
  if (specifier === '@/lib/public-api-base') {
    return { getPublicApiBase: () => 'https://api.example.test' };
  }
  if (specifier === '@/lib/debug/session-logger') {
    return { sessionLogger: { logTrace() {} } };
  }
  if (specifier === 'rrweb') {
    return {
      record(options) {
        emitEvent = options.emit;
        return () => { stopped = true; };
      },
    };
  }
  return clientRequire(specifier);
};

const context = vm.createContext({
  Blob,
  CompressionStream: undefined,
  console,
  exports: {},
  fetch: async (url, init) => {
    posts.push({
      url,
      keepalive: Boolean(init?.keepalive),
      events: JSON.parse(String(init?.body || '[]')).map((event) => event.data.id),
    });
    return { ok: fetchResults.shift() ?? true };
  },
  module: { exports: {} },
  require: sandboxRequire,
  Response,
  setInterval,
  clearInterval,
  window: {},
});
context.exports = context.module.exports;

vm.runInContext(compiled, context, { filename: sourcePath });

const { startRrwebRecording } = context.module.exports;
assert.equal(typeof startRrwebRecording, 'function');

const recorder = await startRrwebRecording('session-a');
assert.ok(recorder, 'recorder should start with mocked rrweb');
assert.equal(typeof emitEvent, 'function');

for (let id = 0; id < 4; id += 1) {
  emitEvent({
    type: 3,
    data: { id, payload: 'x'.repeat(20_000) },
    timestamp: id,
  });
}

await recorder.flush(true);
assert.deepEqual(posts.map((post) => post.events), [[0, 1], [2, 3]]);

await recorder.flush(false);
assert.deepEqual(
  posts.map((post) => post.events),
  [[0, 1], [2, 3], [2, 3]],
  'only the failed second keepalive split should be retried',
);

await recorder.stop();
assert.equal(stopped, true);
