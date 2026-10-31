// Builds the Relationship Lab: engine + all scenes, threads and canon in one static page.
//   node scripts/build-relationship-lab.mjs [--fragment <out.html>]
// Writes public/studio/relationship/index.html (full document). --fragment also writes the
// body-only version used for the published artifact.
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const content = join(app, 'lib/content');
const SKIP = new Set(['index.ts', 'bids.ts']);
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith('.ts') && !p.endsWith('.test.ts') && !SKIP.has(f) ? [p] : [];
  });
const load = async (p) => import(pathToFileURL(p).href);

const scenes = [];
for (const f of walk(join(content, 'routes')).sort()) scenes.push((await load(f)).module);
const order = { story: 0, ambient: 1 };
scenes.sort((a, b) => order[a.scene.kind] - order[b.scene.kind] || a.scene.id.localeCompare(b.scene.id));
const threads = [];
for (const f of walk(join(content, 'kakao')).sort()) threads.push((await load(f)).module);
const canon = {
  characters: [
    (await load(join(content, 'canon/haeun.ts'))).HAEUN_CANON,
    (await load(join(content, 'canon/sua.ts'))).SUA_CANON,
    (await load(join(content, 'canon/jin.ts'))).JIN_CANON,
  ],
  world: (await load(join(content, 'canon/world.ts'))).SEOUL_WORLD,
};

const engineSrc = readFileSync(join(app, 'lib/relationship/engine.ts'), 'utf8');
const engine = ts.transpileModule(engineSrc, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: false },
}).outputText.replace(/^export \{\};?\s*$/m, '');

const data = JSON.stringify({ scenes, threads, canon }).replace(/</g, '\\u003c');
const fragment = readFileSync(join(app, 'lib/relationship/harness/template.html'), 'utf8')
  .replace('/*__ENGINE__*/', () => engine)
  .replace('/*__DATA__*/', () => data);

const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
</head>
<body>
${fragment}
</body>
</html>
`;
const out = join(app, 'public/studio/relationship/index.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, full);
const i = process.argv.indexOf('--fragment');
if (i > 0) writeFileSync(process.argv[i + 1], fragment);
console.log(`lab: ${scenes.length} scenes, ${threads.length} threads → ${out} (${Math.round(full.length / 1024)} KB)`);
