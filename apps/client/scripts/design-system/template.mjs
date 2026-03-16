/**
 * template.mjs — Generates the design-system.html from parsed CSS + examples.
 *
 * Output structure:
 *  1. <style> block 1: full globals.css verbatim (eliminates drift)
 *  2. <style> block 2: ds-* prefixed layout classes for the DS page itself
 *  3. Generation metadata comment
 *  4. Figma capture script tag
 *  5. Rendered sections from examples registry
 */

/**
 * Human-friendly label for a CSS variable name.
 * "--accent-dark" → "Accent Dark"
 */
function varLabel(name) {
  return name
    .replace(/^--/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Render auto-colors section from parsed variables.
 */
function renderAutoColors(parsed) {
  const rootVars = parsed.variables.filter((v) => v.scope === ':root');
  const darkVars = parsed.variables.filter((v) => v.scope !== ':root');

  let html = '';

  // Core tokens
  html += `<h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--muted);">Core Tokens</h3>\n`;
  html += `<div class="ds-colors">\n`;
  for (const v of rootVars) {
    const needsBorder =
      v.value.toLowerCase() === '#fffdf8' ||
      v.value.toLowerCase() === '#fdf6ec';
    html += `  <div class="ds-color-card">
    <div class="ds-color-swatch" style="background: ${v.value};${needsBorder ? ' border-bottom: 1px solid var(--line);' : ''}"></div>
    <div class="ds-color-info">
      <div class="ds-color-name">${varLabel(v.name)}</div>
      <div class="ds-color-value">${v.value}</div>
      <div class="ds-color-token">${v.name}</div>
    </div>
  </div>\n`;
  }
  html += `</div>\n`;

  // Dark theme tokens (if any)
  if (darkVars.length > 0) {
    const grouped = {};
    for (const v of darkVars) {
      if (!grouped[v.scope]) grouped[v.scope] = [];
      grouped[v.scope].push(v);
    }
    for (const [scope, vars] of Object.entries(grouped)) {
      html += `\n<h3 style="font-size: 14px; font-weight: 600; margin: 24px 0 12px; color: var(--muted);">Dark Theme (${scope})</h3>\n`;
      html += `<div class="ds-colors">\n`;
      for (const v of vars) {
        html += `  <div class="ds-color-card">
    <div class="ds-color-swatch" style="background: ${v.value};"></div>
    <div class="ds-color-info">
      <div class="ds-color-name">${varLabel(v.name)}</div>
      <div class="ds-color-value">${v.value}</div>
      <div class="ds-color-token">${v.name}</div>
    </div>
  </div>\n`;
      }
      html += `</div>\n`;
    }
  }

  return html;
}

/**
 * Render auto-animations section from parsed keyframes.
 */
function renderAutoAnimations(parsed) {
  if (parsed.keyframes.length === 0) {
    return `<p style="color: var(--muted); font-size: 14px;">No @keyframes found in globals.css.</p>`;
  }

  const colors = ['#ff6b2c', '#0f766e', '#4a90d9', '#e8485c', '#f0c040', '#8b5cf6', '#06b6d4', '#ec4899'];

  let html = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;">\n`;
  parsed.keyframes.forEach((kf, i) => {
    const bg = colors[i % colors.length];
    html += `  <div class="ds-component-card" style="padding: 16px;">
    <div class="ds-component-label">${kf.name}</div>
    <div class="ds-anim-box" style="background: ${bg}; animation: ${kf.name} 2s ease infinite;">
      ${kf.name}
    </div>
  </div>\n`;
  });
  html += `</div>`;

  return html;
}

/**
 * DS-page-only layout styles (prefixed with ds-*).
 * These never conflict with globals.css.
 */
const DS_LAYOUT_CSS = `
/* Design System page layout — ds-* prefixed, no conflict with globals.css */
.ds-page {
  max-width: 1080px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}
.ds-hero {
  text-align: center;
  padding: 48px 0 56px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 56px;
}
.ds-hero h1 { font-size: 42px; font-weight: 700; margin-bottom: 8px; }
.ds-hero p { color: var(--muted); font-size: 16px; }
.ds-section { margin-bottom: 56px; }
.ds-section-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.14em; color: var(--muted); margin-bottom: 8px;
}
.ds-section-heading { font-size: 28px; font-weight: 700; margin-bottom: 6px; }
.ds-section-desc { color: var(--muted); margin-bottom: 24px; max-width: 600px; }
.ds-divider { border: none; border-top: 1px solid var(--line); margin: 0 0 56px; }

/* Color swatches */
.ds-colors { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
.ds-color-card {
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 16px; overflow: hidden;
  box-shadow: 0 4px 16px rgba(180,131,87,0.08);
}
.ds-color-swatch { height: 80px; }
.ds-color-info { padding: 12px 14px; }
.ds-color-name { font-size: 13px; font-weight: 600; }
.ds-color-value { font-size: 12px; color: var(--muted); font-family: monospace; }
.ds-color-token { font-size: 11px; color: var(--mint); font-family: monospace; margin-top: 2px; }

/* Typography samples */
.ds-type-sample {
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 16px; padding: 20px 24px; margin-bottom: 12px;
  display: flex; justify-content: space-between; align-items: baseline; gap: 16px;
}
.ds-type-meta { flex-shrink: 0; text-align: right; min-width: 140px; }
.ds-type-meta-size { font-size: 12px; font-family: monospace; color: var(--muted); }
.ds-type-meta-weight { font-size: 11px; color: var(--mint); }

/* Spacing */
.ds-spacing-grid { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-end; }
.ds-spacing-item { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.ds-spacing-box { background: linear-gradient(135deg, var(--accent), #ff9a60); border-radius: 6px; opacity: 0.7; }
.ds-spacing-label { font-size: 11px; font-family: monospace; color: var(--muted); }
.ds-spacing-value { font-size: 10px; font-family: monospace; color: var(--ink); font-weight: 600; }

/* Radius */
.ds-radius-grid { display: flex; flex-wrap: wrap; gap: 24px; align-items: center; }
.ds-radius-item { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.ds-radius-box { width: 64px; height: 64px; background: var(--panel); border: 2px solid var(--accent); }
.ds-radius-label { font-size: 11px; font-family: monospace; color: var(--muted); }

/* Component showcase */
.ds-component-card {
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 18px; padding: 24px;
  box-shadow: 0 10px 28px rgba(180,131,87,0.14);
}
.ds-component-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--muted); margin-bottom: 16px;
}
.ds-component-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }

/* Gradients */
.ds-gradient-card {
  border-radius: 16px; height: 100px;
  display: flex; align-items: flex-end; padding: 12px 16px;
}
.ds-gradient-label {
  font-size: 11px; font-weight: 600; padding: 3px 8px;
  border-radius: 6px; background: rgba(255,255,255,0.9); color: var(--ink);
}

/* Animation preview */
.ds-anim-box {
  width: 100%; height: 48px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600; color: #fff; cursor: pointer;
}
`.trim();

/**
 * Generate the full design-system.html content.
 * @param {import('./parse-css.mjs').ParseResult} parsed
 * @param {import('./examples.mjs').sections} sections
 * @returns {string}
 */
export function generateHTML(parsed, sections) {
  const now = new Date().toISOString();
  const varCount = parsed.variables.length;
  const classCount = new Set(parsed.rules.flatMap((r) => r.classes)).size;
  const kfCount = parsed.keyframes.length;

  let body = '';

  // Hero
  body += `
  <!-- HERO -->
  <div class="ds-hero">
    <div style="width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), #e8a020); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: #fff; box-shadow: 0 8px 32px rgba(255,107,44,0.25); margin: 0 auto 20px;">T</div>
    <h1>Tong Design System</h1>
    <p>Visual language for an AI language-learning companion</p>
  </div>
`;

  // Sections
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];

    body += `\n  <!-- ${s.number}. ${s.title.toUpperCase()} -->\n`;
    body += `  <section class="ds-section">\n`;
    body += `    <div class="ds-section-title">${s.number} / ${s.category}</div>\n`;
    body += `    <h2 class="ds-section-heading">${s.title}</h2>\n`;
    if (s.description) {
      body += `    <p class="ds-section-desc">${s.description}</p>\n`;
    }
    body += '\n';

    if (s.type === 'auto-colors') {
      body += renderAutoColors(parsed);
    } else if (s.type === 'auto-animations') {
      body += renderAutoAnimations(parsed);
    } else {
      body += s.html;
    }

    body += `\n  </section>\n`;

    // Divider between sections (except after the last)
    if (i < sections.length - 1) {
      body += `\n  <hr class="ds-divider">\n`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tong Design System</title>
<!-- Generated: ${now} | ${varCount} variables, ${classCount} classes, ${kfCount} keyframes -->
<style>
/* ══════════════════════════════════════════════════════════════
   BLOCK 1: globals.css — verbatim embed (single source of truth)
   ══════════════════════════════════════════════════════════════ */
${parsed.raw}
</style>
<style>
/* ══════════════════════════════════════════════════════════════
   BLOCK 2: Design system page layout (ds-* prefixed, no conflicts)
   ══════════════════════════════════════════════════════════════ */
${DS_LAYOUT_CSS}
</style>
<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
</head>
<body>

<div class="ds-page">
${body}
</div>

</body>
</html>
`;
}
