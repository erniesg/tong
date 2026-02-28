/**
 * parse-css.mjs — Regex-based CSS parser for globals.css
 *
 * Extracts:
 *  - CSS custom properties (grouped by selector, e.g. :root, .dark)
 *  - Class selectors with their properties
 *  - Element selectors with their properties
 *  - @keyframes animations
 *  - @media queries
 *  - @import / font imports
 */

import { readFileSync } from 'node:fs';

/**
 * @typedef {Object} CSSVariable
 * @property {string} name   - e.g. "--bg"
 * @property {string} value  - e.g. "#fdf6ec"
 * @property {string} scope  - e.g. ":root" or ".dark"
 */

/**
 * @typedef {Object} CSSRule
 * @property {string} selector    - e.g. ".card" or "button, .button"
 * @property {string} body        - raw property block
 * @property {string[]} classes   - extracted class names, e.g. ["card"]
 * @property {string[]} elements  - extracted element names, e.g. ["button"]
 */

/**
 * @typedef {Object} CSSKeyframes
 * @property {string} name - animation name
 * @property {string} body - full keyframes block content
 */

/**
 * @typedef {Object} CSSMediaQuery
 * @property {string} condition - e.g. "(max-width: 900px)"
 * @property {string} body      - inner rules
 */

/**
 * @typedef {Object} ParseResult
 * @property {CSSVariable[]} variables
 * @property {CSSRule[]} rules
 * @property {CSSKeyframes[]} keyframes
 * @property {CSSMediaQuery[]} mediaQueries
 * @property {string[]} imports
 * @property {string} raw - full file contents
 */

/**
 * Remove CSS comments from source text.
 */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Find matching closing brace for an opening brace at `start`.
 */
function findClosingBrace(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Extract class names from a CSS selector string.
 * ".card h2, .card h3" → ["card"]
 * "button, .button" → ["button"]
 * "button.secondary" → ["secondary"]
 */
function extractClassNames(selector) {
  const classes = new Set();
  const re = /\.([a-zA-Z_-][\w-]*)/g;
  let m;
  while ((m = re.exec(selector))) {
    classes.add(m[1]);
  }
  return [...classes];
}

/**
 * Extract element names from a CSS selector string.
 * "button, .button" → ["button"]
 * "html, body" → ["html", "body"]
 */
function extractElementNames(selector) {
  const elements = new Set();
  // Split by comma, then extract leading element name from each part
  for (const part of selector.split(',')) {
    const trimmed = part.trim();
    const m = trimmed.match(/^([a-zA-Z][\w-]*)/);
    if (m) elements.add(m[1]);
  }
  return [...elements];
}

/**
 * Parse a CSS file and return structured data.
 * @param {string} filePath
 * @returns {ParseResult}
 */
export function parseCSS(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const cleaned = stripComments(raw);

  const variables = [];
  const rules = [];
  const keyframes = [];
  const mediaQueries = [];
  const imports = [];

  // 1. Extract @import lines
  const importRe = /^@import\s+[^;]+;/gm;
  let im;
  while ((im = importRe.exec(cleaned))) {
    imports.push(im[0]);
  }

  // 2. Walk top-level blocks
  // We need to find top-level selectors/at-rules and their brace-delimited bodies.
  // Skip @import lines (already extracted).
  let pos = 0;
  while (pos < cleaned.length) {
    // Skip whitespace
    while (pos < cleaned.length && /\s/.test(cleaned[pos])) pos++;
    if (pos >= cleaned.length) break;

    // Skip @import lines
    if (cleaned.startsWith('@import', pos)) {
      const semi = cleaned.indexOf(';', pos);
      if (semi === -1) break;
      pos = semi + 1;
      continue;
    }

    // Find the opening brace
    const braceOpen = cleaned.indexOf('{', pos);
    if (braceOpen === -1) break;

    const preamble = cleaned.slice(pos, braceOpen).trim();
    const braceClose = findClosingBrace(cleaned, braceOpen);
    if (braceClose === -1) break;

    const body = cleaned.slice(braceOpen + 1, braceClose).trim();

    if (preamble.startsWith('@keyframes')) {
      // Keyframes
      const name = preamble.replace('@keyframes', '').trim();
      keyframes.push({ name, body });
    } else if (preamble.startsWith('@media')) {
      // Media query
      const condition = preamble.replace('@media', '').trim();
      mediaQueries.push({ condition, body });
    } else {
      // Regular rule or variable block
      // Check if body contains custom properties
      const varRe = /(--[\w-]+)\s*:\s*([^;]+);/g;
      let v;
      const foundVars = [];
      while ((v = varRe.exec(body))) {
        foundVars.push({ name: v[1], value: v[2].trim(), scope: preamble });
      }
      if (foundVars.length > 0) {
        variables.push(...foundVars);
      }

      // Always add as a rule (even :root — it may have non-variable properties)
      const classes = extractClassNames(preamble);
      const elements = extractElementNames(preamble);
      rules.push({ selector: preamble, body, classes, elements });
    }

    pos = braceClose + 1;
  }

  return { variables, rules, keyframes, mediaQueries, imports, raw };
}

/**
 * Get a deduplicated list of all class names defined in the CSS.
 * @param {ParseResult} parsed
 * @returns {string[]}
 */
export function getAllClassNames(parsed) {
  const set = new Set();
  for (const rule of parsed.rules) {
    for (const cls of rule.classes) set.add(cls);
  }
  // Also check inside media queries
  for (const mq of parsed.mediaQueries) {
    const classRe = /\.([a-zA-Z_-][\w-]*)/g;
    let m;
    while ((m = classRe.exec(mq.body))) {
      set.add(m[1]);
    }
  }
  return [...set].sort();
}

/**
 * Get a deduplicated list of all CSS variable names.
 * @param {ParseResult} parsed
 * @returns {string[]}
 */
export function getAllVariableNames(parsed) {
  return [...new Set(parsed.variables.map((v) => v.name))].sort();
}
