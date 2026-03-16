#!/usr/bin/env node
/**
 * build-design-system.mjs — Orchestrator for the design system pipeline.
 *
 * Usage:
 *   node scripts/build-design-system.mjs            # one-shot build
 *   node scripts/build-design-system.mjs --watch     # watch globals.css + examples
 *   node scripts/build-design-system.mjs --audit     # check freshness + coverage
 *   node scripts/build-design-system.mjs --push      # build + push to Figma (prints instructions)
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSS } from './design-system/parse-css.mjs';
import { sections } from './design-system/examples.mjs';
import { generateHTML } from './design-system/template.mjs';
import { audit, printAudit } from './design-system/audit.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = resolve(__dirname, '..');
const CSS_PATH = resolve(CLIENT_DIR, 'app/globals.css');
const HTML_PATH = resolve(CLIENT_DIR, 'design-system.html');

const args = process.argv.slice(2);
const isAudit = args.includes('--audit');
const isWatch = args.includes('--watch');
const isPush = args.includes('--push');

function build() {
  const parsed = parseCSS(CSS_PATH);
  const html = generateHTML(parsed, sections);
  writeFileSync(HTML_PATH, html, 'utf-8');

  const varCount = parsed.variables.length;
  const classCount = new Set(parsed.rules.flatMap((r) => r.classes)).size;
  const kfCount = parsed.keyframes.length;

  console.log(
    `  Built design-system.html (${varCount} variables, ${classCount} classes, ${kfCount} keyframes)`
  );
  return html;
}

if (isAudit) {
  // Audit mode: check freshness and coverage
  const result = audit(CSS_PATH, HTML_PATH);
  printAudit(result);
  process.exit(result.fresh ? 0 : 1);
} else if (isWatch) {
  // Watch mode
  const { watch } = await import('node:fs');

  console.log('  Watching for changes...');
  console.log(`    CSS:      ${CSS_PATH}`);
  console.log(`    Examples: ${resolve(__dirname, 'design-system/examples.mjs')}`);
  console.log('');

  build();

  const watchFiles = [
    CSS_PATH,
    resolve(__dirname, 'design-system/examples.mjs'),
  ];

  for (const file of watchFiles) {
    let debounce = null;
    watch(file, () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        console.log(`  Change detected: ${file}`);
        try {
          build();
        } catch (err) {
          console.error(`  Build error: ${err.message}`);
        }
      }, 200);
    });
  }
} else if (isPush) {
  // Build first, then print Figma push instructions
  build();
  console.log('');
  console.log('  To push to Figma, use the MCP tool:');
  console.log('    generate_figma_design with:');
  console.log('      outputMode: "existingFile"');
  console.log('      fileKey: "pGb5lVI556DnNJpbXvccDH"');
  console.log('');
  console.log('  Or open design-system.html in a browser — the Figma capture script is embedded.');
} else {
  // One-shot build
  build();
}
