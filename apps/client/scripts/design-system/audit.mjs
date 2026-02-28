/**
 * audit.mjs — Freshness and coverage checks for design-system.html.
 *
 * Two checks:
 *  1. Freshness: regenerate HTML in memory, compare to committed file → exit 1 if stale
 *  2. Coverage: compare parsed class list vs coversClasses in examples → report undocumented
 */

import { readFileSync, existsSync } from 'node:fs';
import { parseCSS, getAllClassNames, getAllVariableNames } from './parse-css.mjs';
import { sections, getCoveredClasses } from './examples.mjs';
import { generateHTML } from './template.mjs';

/**
 * Run the audit and return results.
 * @param {string} cssPath     - path to globals.css
 * @param {string} htmlPath    - path to design-system.html
 * @returns {{ fresh: boolean, coverage: { total: number, covered: number, percent: number, uncovered: string[] }, varCoverage: { total: number, percent: number } }}
 */
export function audit(cssPath, htmlPath) {
  const parsed = parseCSS(cssPath);
  const expected = generateHTML(parsed, sections);

  // Freshness
  let fresh = false;
  if (existsSync(htmlPath)) {
    const current = readFileSync(htmlPath, 'utf-8');
    // Compare ignoring the Generated timestamp line
    const stripTimestamp = (s) =>
      s.replace(/<!-- Generated: .+? -->/, '<!-- Generated: __TIMESTAMP__ -->');
    fresh = stripTimestamp(current) === stripTimestamp(expected);
  }

  // Class coverage
  const allClasses = getAllClassNames(parsed);
  const covered = getCoveredClasses();
  // ds-* classes are part of the DS page layout, not globals.css — exclude them
  const globalClasses = allClasses.filter((c) => !c.startsWith('ds-'));
  const uncovered = globalClasses.filter((c) => !covered.has(c));
  const coveredCount = globalClasses.length - uncovered.length;
  const percent =
    globalClasses.length > 0
      ? Math.round((coveredCount / globalClasses.length) * 100)
      : 100;

  // Variable coverage (auto-colors covers all :root variables)
  const allVars = getAllVariableNames(parsed);

  return {
    fresh,
    coverage: {
      total: globalClasses.length,
      covered: coveredCount,
      percent,
      uncovered,
    },
    varCoverage: {
      total: allVars.length,
      percent: 100, // auto-colors always covers all variables
    },
  };
}

/**
 * Print audit results to stdout.
 * @param {{ fresh: boolean, coverage: object, varCoverage: object }} result
 */
export function printAudit(result) {
  console.log('\n  Design System Audit');
  console.log('  ===================\n');

  // Freshness
  if (result.fresh) {
    console.log('  Freshness:  OK (HTML matches generated output)');
  } else {
    console.log('  Freshness:  STALE (run ds:build to regenerate)');
  }

  // Variables
  console.log(
    `  Variables:  ${result.varCoverage.total} total, ${result.varCoverage.percent}% covered`
  );

  // Classes
  console.log(
    `  Classes:    ${result.coverage.total} total, ${result.coverage.covered} covered (${result.coverage.percent}%)`
  );

  if (result.coverage.uncovered.length > 0) {
    console.log(`\n  Uncovered classes (${result.coverage.uncovered.length}):`);
    for (const cls of result.coverage.uncovered) {
      console.log(`    - .${cls}`);
    }
  }

  console.log('');
}
