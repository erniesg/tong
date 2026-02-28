/**
 * examples.mjs — Human-curated component examples for the design system showcase.
 *
 * Section types:
 *  - "auto-colors"     — generates color swatches from parsed CSS variables
 *  - "auto-animations" — generates animation previews from @keyframes
 *  - "manual"          — uses curated HTML snippets (with coversClasses for audit)
 *
 * Each section has:
 *  - id:            unique identifier
 *  - number:        display number (e.g. "01")
 *  - category:      grouping label (e.g. "Foundation", "Components", "Game Mode")
 *  - title:         section heading
 *  - description:   optional subtext
 *  - type:          "auto-colors" | "auto-animations" | "manual"
 *  - html:          (manual only) HTML string to render
 *  - coversClasses: (manual only) list of CSS classes this section demonstrates
 */

/** @type {Array<{id: string, number: string, category: string, title: string, description?: string, type: string, html?: string, coversClasses?: string[]}>} */
export const sections = [
  // ── 01 Colors ──────────────────────────────────────────────
  {
    id: 'colors',
    number: '01',
    category: 'Foundation',
    title: 'Color Palette',
    description:
      'Warm, inviting tones centered on cream backgrounds and orange accents, with teal for success and progress states.',
    type: 'auto-colors',
  },

  // ── 02 Gradients ───────────────────────────────────────────
  {
    id: 'gradients',
    number: '02',
    category: 'Foundation',
    title: 'Gradients',
    description:
      'Background gradients and fills used across light and dark contexts.',
    type: 'manual',
    coversClasses: [],
    html: `
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
      <div class="ds-gradient-card" style="background: radial-gradient(circle at 15% 20%, rgba(255,184,140,0.38), transparent 42%), radial-gradient(circle at 82% 5%, rgba(15,118,110,0.2), transparent 38%), #fdf6ec;">
        <span class="ds-gradient-label">Page Background</span>
      </div>
      <div class="ds-gradient-card" style="background: linear-gradient(135deg, #232946, #3f5f7f 58%, #627d98);">
        <span class="ds-gradient-label">Video Frame</span>
      </div>
      <div class="ds-gradient-card" style="background: linear-gradient(90deg, #0f766e, #34d399);">
        <span class="ds-gradient-label">Metric / Progress</span>
      </div>
      <div class="ds-gradient-card" style="background: linear-gradient(90deg, #ff8f46, #ffc16f);">
        <span class="ds-gradient-label">Spark / Orange</span>
      </div>
      <div class="ds-gradient-card" style="background: linear-gradient(135deg, var(--accent), #e8a020);">
        <span class="ds-gradient-label">Tong Avatar</span>
      </div>
      <div class="ds-gradient-card" style="background: linear-gradient(180deg, rgba(22,33,62,0.97) 0%, rgba(26,26,46,1) 100%);">
        <span class="ds-gradient-label" style="color: #fff; background: rgba(255,255,255,0.15);">Scene Bottom Panel</span>
      </div>
    </div>`,
  },

  // ── 03 Typography ──────────────────────────────────────────
  {
    id: 'typography',
    number: '03',
    category: 'Foundation',
    title: 'Typography',
    description:
      'Space Grotesk for Latin, Noto Sans KR for Korean/CJK. Fluid sizing for responsive headings.',
    type: 'manual',
    coversClasses: ['page-title', 'kicker', 'page-copy', 'korean'],
    html: `
    <div class="ds-type-sample">
      <span style="font-size: 40px; font-weight: 700; line-height: 1.05;">Page Title</span>
      <div class="ds-type-meta">
        <div class="ds-type-meta-size">clamp(28px, 4vw, 40px)</div>
        <div class="ds-type-meta-weight">700 &middot; .page-title</div>
      </div>
    </div>
    <div class="ds-type-sample">
      <span style="font-size: 20px; font-weight: 700;">Section Heading</span>
      <div class="ds-type-meta">
        <div class="ds-type-meta-size">20px</div>
        <div class="ds-type-meta-weight">700</div>
      </div>
    </div>
    <div class="ds-type-sample">
      <span style="font-size: 17px;">Body / Dialogue</span>
      <div class="ds-type-meta">
        <div class="ds-type-meta-size">17px</div>
        <div class="ds-type-meta-weight">400</div>
      </div>
    </div>
    <div class="ds-type-sample">
      <span style="font-size: 15px; color: var(--muted);">Muted / Secondary</span>
      <div class="ds-type-meta">
        <div class="ds-type-meta-size">15px</div>
        <div class="ds-type-meta-weight">400 muted</div>
      </div>
    </div>
    <div class="ds-type-sample">
      <span style="font-size: 14px; font-weight: 600;">Button / Label</span>
      <div class="ds-type-meta">
        <div class="ds-type-meta-size">14px</div>
        <div class="ds-type-meta-weight">600</div>
      </div>
    </div>
    <div class="ds-type-sample">
      <span style="font-size: 13px; font-weight: 600;">Nav / Table</span>
      <div class="ds-type-meta">
        <div class="ds-type-meta-size">13px</div>
        <div class="ds-type-meta-weight">600</div>
      </div>
    </div>
    <div class="ds-type-sample">
      <span style="font-size: 12px; font-weight: 600;">Pill / Caption</span>
      <div class="ds-type-meta">
        <div class="ds-type-meta-size">12px</div>
        <div class="ds-type-meta-weight">600</div>
      </div>
    </div>
    <div class="ds-type-sample">
      <span class="kicker">KICKER / OVERLINE</span>
      <div class="ds-type-meta">
        <div class="ds-type-meta-size">11px uppercase</div>
        <div class="ds-type-meta-weight">700 + tracking &middot; .kicker</div>
      </div>
    </div>
    <div class="ds-type-sample">
      <span class="korean" style="font-size: 20px;">&#xC548;&#xB155;&#xD558;&#xC138;&#xC694;! &#xD55C;&#xAD6D;&#xC5B4; &#xD14D;&#xC2A4;&#xD2B8;</span>
      <div class="ds-type-meta">
        <div class="ds-type-meta-size">20px</div>
        <div class="ds-type-meta-weight">Noto Sans KR &middot; .korean</div>
      </div>
    </div>`,
  },

  // ── 04 Spacing & Radius ────────────────────────────────────
  {
    id: 'spacing',
    number: '04',
    category: 'Foundation',
    title: 'Spacing & Border Radius',
    description: '',
    type: 'manual',
    coversClasses: [],
    html: `
    <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 16px; color: var(--muted);">Spacing Scale</h3>
    <div class="ds-spacing-grid" style="margin-bottom: 32px;">
      ${[4, 6, 8, 10, 12, 14, 16, 18, 24, 28, 32, 48, 56]
        .map(
          (s) => `
      <div class="ds-spacing-item">
        <div class="ds-spacing-box" style="width: ${s}px; height: ${s}px;"></div>
        <div class="ds-spacing-value">${s}px</div>
      </div>`
        )
        .join('')}
    </div>

    <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 16px; color: var(--muted);">Border Radius Scale</h3>
    <div class="ds-radius-grid">
      ${[
        ['6px', '6px'],
        ['10px', '10px'],
        ['12px', '12px'],
        ['14px', '14px'],
        ['16px', '16px'],
        ['18px', '18px card'],
        ['26px', '26px frame'],
        ['50%', '50% circle'],
        ['999px', '999px pill'],
      ]
        .map(
          ([r, label]) => `
      <div class="ds-radius-item">
        <div class="ds-radius-box" style="border-radius: ${r};"></div>
        <div class="ds-radius-label">${label}</div>
      </div>`
        )
        .join('')}
    </div>`,
  },

  // ── 05 Buttons ─────────────────────────────────────────────
  {
    id: 'buttons',
    number: '05',
    category: 'Components',
    title: 'Buttons',
    description:
      'Three core variants plus game-specific CTAs. All share the same font family and transition behavior.',
    type: 'manual',
    coversClasses: ['button', 'secondary', 'ghost'],
    html: `
    <div class="ds-component-card">
      <div class="ds-component-label">Standard Variants</div>
      <div class="ds-component-row" style="margin-bottom: 16px;">
        <button>Primary</button>
        <button class="secondary">Secondary</button>
        <button class="ghost">Ghost</button>
        <button disabled>Disabled</button>
      </div>
    </div>`,
  },

  // ── 06 Pills & Badges ─────────────────────────────────────
  {
    id: 'pills',
    number: '06',
    category: 'Components',
    title: 'Pills & Badges',
    description: '',
    type: 'manual',
    coversClasses: ['pill'],
    html: `
    <div class="ds-component-card">
      <div class="ds-component-label">Pills</div>
      <div class="ds-component-row">
        <span class="pill">Grammar</span>
        <span class="pill">Vocabulary</span>
        <span class="pill">Listening</span>
        <span class="pill">Speaking</span>
      </div>
    </div>`,
  },

  // ── 07 Cards ───────────────────────────────────────────────
  {
    id: 'cards',
    number: '07',
    category: 'Components',
    title: 'Cards',
    description: '',
    type: 'manual',
    coversClasses: ['card'],
    html: `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
      <div class="card">
        <h3 style="margin: 0 0 8px;">Topic Card</h3>
        <p style="margin: 0; color: var(--muted); line-height: 1.5;">Warm panel background with subtle amber box-shadow. Border radius 18px.</p>
      </div>
      <div class="card">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
          <span class="pill">Vocabulary</span>
        </div>
        <h3 style="margin: 0 0 8px;">With Pills</h3>
        <p style="margin: 0; color: var(--muted); line-height: 1.5;">Cards can contain pills, progress bars, and nested elements.</p>
        <div class="metric-bar" style="margin-top: 12px;">
          <div class="metric-fill" style="width: 68%;"></div>
        </div>
      </div>
      <div class="card">
        <h3 style="margin: 0 0 8px;">Nested Card</h3>
        <div class="card" style="padding: 12px; box-shadow: none;">
          <p style="margin: 0; color: var(--muted); line-height: 1.5; font-size: 13px;">Inner card with reduced padding and no shadow.</p>
        </div>
      </div>
    </div>`,
  },

  // ── 08 Form Inputs ─────────────────────────────────────────
  {
    id: 'inputs',
    number: '08',
    category: 'Components',
    title: 'Form Inputs',
    description: '',
    type: 'manual',
    coversClasses: [],
    html: `
    <div class="ds-component-card">
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
        <div>
          <div class="ds-component-label">Text Input</div>
          <input type="text" placeholder="Type something..." style="max-width: 100%;">
        </div>
        <div>
          <div class="ds-component-label">Select</div>
          <select style="max-width: 100%;">
            <option>Korean</option>
            <option>Japanese</option>
            <option>Mandarin</option>
          </select>
        </div>
        <div style="grid-column: span 2;">
          <div class="ds-component-label">Textarea</div>
          <textarea rows="3" placeholder="Write your response..." style="max-width: 100%;"></textarea>
        </div>
      </div>
    </div>`,
  },

  // ── 09 Progress & Metrics ──────────────────────────────────
  {
    id: 'progress',
    number: '09',
    category: 'Components',
    title: 'Progress & Metrics',
    description: '',
    type: 'manual',
    coversClasses: ['metric-bar', 'metric-fill', 'spark'],
    html: `
    <div class="ds-component-card">
      <div class="ds-component-label">Metric Bar (Teal)</div>
      <div class="metric-bar" style="margin-bottom: 16px;">
        <div class="metric-fill" style="width: 72%;"></div>
      </div>

      <div class="ds-component-label">Spark Bar (Orange)</div>
      <div class="spark" style="margin-bottom: 16px;">
        <span style="width: 45%;"></span>
      </div>
    </div>`,
  },

  // ── 10 Navigation ──────────────────────────────────────────
  {
    id: 'navigation',
    number: '10',
    category: 'Components',
    title: 'Navigation',
    description: '',
    type: 'manual',
    coversClasses: ['nav-links', 'nav-link'],
    html: `
    <div class="ds-component-card">
      <div class="ds-component-label">Nav Links</div>
      <div class="nav-links">
        <a class="nav-link" href="#">Home</a>
        <a class="nav-link" href="#">Practice</a>
        <a class="nav-link" href="#">Progress</a>
        <a class="nav-link" href="#">Settings</a>
      </div>
    </div>`,
  },

  // ── 11 Chat Bubbles ────────────────────────────────────────
  {
    id: 'chat',
    number: '11',
    category: 'Components',
    title: 'Chat Bubbles',
    description:
      'Character-specific color coding for the conversation UI.',
    type: 'manual',
    coversClasses: [
      'chat-bubble',
      'chat-character',
      'chat-tong',
      'chat-user',
    ],
    html: `
    <div class="ds-component-card">
      <div style="display: flex; flex-direction: column; gap: 10px; max-width: 400px;">
        <div class="chat-bubble chat-character">
          <strong style="font-size: 12px;">Ha-eun</strong><br>
          <span class="korean">&#xC548;&#xB155;&#xD558;&#xC138;&#xC694;! &#xC624;&#xB298; &#xBB50; &#xD560; &#xAC70;&#xC608;&#xC694;?</span>
        </div>
        <div class="chat-bubble chat-tong">
          <strong style="font-size: 12px; color: var(--mint);">Tong</strong><br>
          Try asking about her weekend plans!
        </div>
        <div class="chat-bubble chat-user">
          <span class="korean">&#xC8FC;&#xB9D0;&#xC5D0; &#xBB50; &#xD574;&#xC694;?</span>
        </div>
      </div>
    </div>`,
  },

  // ── 12 Tables ──────────────────────────────────────────────
  {
    id: 'tables',
    number: '12',
    category: 'Components',
    title: 'Tables',
    description: '',
    type: 'manual',
    coversClasses: ['table'],
    html: `
    <div class="ds-component-card">
      <table class="table">
        <thead>
          <tr>
            <th>Word</th>
            <th>Romanization</th>
            <th>Translation</th>
            <th>Mastery</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="korean">&#xC548;&#xB155;&#xD558;&#xC138;&#xC694;</td>
            <td>annyeonghaseyo</td>
            <td>Hello</td>
            <td><div class="spark" style="width: 80px;"><span style="width: 85%;"></span></div></td>
          </tr>
          <tr>
            <td class="korean">&#xAC10;&#xC0AC;&#xD569;&#xB2C8;&#xB2E4;</td>
            <td>gamsahamnida</td>
            <td>Thank you</td>
            <td><div class="spark" style="width: 80px;"><span style="width: 62%;"></span></div></td>
          </tr>
          <tr>
            <td class="korean">&#xB9DB;&#xC788;&#xC5B4;&#xC694;</td>
            <td>masisseoyo</td>
            <td>It's delicious</td>
            <td><div class="spark" style="width: 80px;"><span style="width: 30%;"></span></div></td>
          </tr>
        </tbody>
      </table>
    </div>`,
  },

  // ── 13 Layout Utilities ────────────────────────────────────
  {
    id: 'layout',
    number: '13',
    category: 'Components',
    title: 'Layout Utilities',
    description:
      'Grid, stack, and row helpers for composing page layouts.',
    type: 'manual',
    coversClasses: [
      'grid',
      'grid-2',
      'grid-3',
      'stack',
      'row',
      'app-shell',
      'page-header',
    ],
    html: `
    <div class="ds-component-card" style="margin-bottom: 16px;">
      <div class="ds-component-label">.grid .grid-3</div>
      <div class="grid grid-3">
        <div class="card" style="padding: 12px; text-align: center; font-size: 13px;">Col 1</div>
        <div class="card" style="padding: 12px; text-align: center; font-size: 13px;">Col 2</div>
        <div class="card" style="padding: 12px; text-align: center; font-size: 13px;">Col 3</div>
      </div>
    </div>
    <div class="ds-component-card" style="margin-bottom: 16px;">
      <div class="ds-component-label">.grid .grid-2</div>
      <div class="grid grid-2">
        <div class="card" style="padding: 12px; text-align: center; font-size: 13px;">Col 1</div>
        <div class="card" style="padding: 12px; text-align: center; font-size: 13px;">Col 2</div>
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div class="ds-component-card">
        <div class="ds-component-label">.stack</div>
        <div class="stack">
          <div class="card" style="padding: 10px; font-size: 13px;">Item 1</div>
          <div class="card" style="padding: 10px; font-size: 13px;">Item 2</div>
          <div class="card" style="padding: 10px; font-size: 13px;">Item 3</div>
        </div>
      </div>
      <div class="ds-component-card">
        <div class="ds-component-label">.row</div>
        <div class="row">
          <span style="font-size: 14px; font-weight: 600;">Label</span>
          <span class="pill">Value</span>
        </div>
        <div class="row" style="margin-top: 8px;">
          <span style="font-size: 14px; font-weight: 600;">Another</span>
          <button class="secondary" style="font-size: 12px; padding: 6px 10px;">Action</button>
        </div>
      </div>
    </div>`,
  },

  // ── 14 Video & Overlay ─────────────────────────────────────
  {
    id: 'video',
    number: '14',
    category: 'Components',
    title: 'Video Frame & Overlay',
    description:
      'Video player frame with subtitle overlay lanes and token row.',
    type: 'manual',
    coversClasses: [
      'video-frame',
      'overlay-lanes',
      'overlay-script',
      'overlay-romanized',
      'overlay-english',
      'token-row',
      'token-button',
    ],
    html: `
    <div class="video-frame" style="min-height: 220px;">
      <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">Video Content Area</div>
      <div class="overlay-lanes">
        <div class="overlay-script korean">&#xC548;&#xB155;&#xD558;&#xC138;&#xC694;!</div>
        <div class="overlay-romanized">annyeonghaseyo!</div>
        <div class="overlay-english">Hello!</div>
        <div class="token-row" style="margin-top: 6px;">
          <button class="token-button">&#xC548;&#xB155;</button>
          <button class="token-button">&#xD558;&#xC138;&#xC694;</button>
        </div>
      </div>
    </div>`,
  },

  // ── 15 Mobile Frame ────────────────────────────────────────
  {
    id: 'mobile',
    number: '15',
    category: 'Components',
    title: 'Mobile Frame',
    description:
      'Phone-like container used for chat/hangout previews.',
    type: 'manual',
    coversClasses: [
      'mobile-frame',
      'mobile-head',
      'mobile-body',
    ],
    html: `
    <div class="mobile-frame" style="max-width: 360px;">
      <div class="mobile-head">
        <div style="font-size: 14px; font-weight: 600;">Hangout Preview</div>
        <div style="font-size: 12px; color: var(--muted);">Cafe Scene</div>
      </div>
      <div class="mobile-body" style="max-height: 200px;">
        <div class="chat-bubble chat-character">
          <strong style="font-size: 12px;">Ha-eun</strong><br>
          <span class="korean">&#xC5B4;&#xC11C; &#xC624;&#xC138;&#xC694;!</span>
        </div>
        <div class="chat-bubble chat-user">
          <span class="korean">&#xB124;!</span>
        </div>
      </div>
    </div>`,
  },

  // ── 16 Shadows ─────────────────────────────────────────────
  {
    id: 'shadows',
    number: '16',
    category: 'Foundation',
    title: 'Shadows & Elevation',
    description: '',
    type: 'manual',
    coversClasses: [],
    html: `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;">
      <div style="background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 20px; text-align: center; box-shadow: 0 4px 12px rgba(180,131,87,0.1);">
        <div style="font-size: 13px; font-weight: 600;">Level 1</div>
        <div style="font-size: 11px; color: var(--muted); font-family: monospace; margin-top: 4px;">0 4px 12px<br>rgba(180,131,87,0.1)</div>
      </div>
      <div style="background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 20px; text-align: center; box-shadow: 0 10px 28px rgba(180,131,87,0.14);">
        <div style="font-size: 13px; font-weight: 600;">Level 2 (Card)</div>
        <div style="font-size: 11px; color: var(--muted); font-family: monospace; margin-top: 4px;">0 10px 28px<br>rgba(180,131,87,0.14)</div>
      </div>
      <div style="background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 20px; text-align: center; box-shadow: 0 16px 35px rgba(117,90,64,0.2);">
        <div style="font-size: 13px; font-weight: 600;">Level 3 (Frame)</div>
        <div style="font-size: 11px; color: var(--muted); font-family: monospace; margin-top: 4px;">0 16px 35px<br>rgba(117,90,64,0.2)</div>
      </div>
    </div>`,
  },

  // ── 17 Animations ──────────────────────────────────────────
  {
    id: 'animations',
    number: '17',
    category: 'Foundation',
    title: 'Animations',
    description: 'All @keyframes defined in globals.css.',
    type: 'auto-animations',
  },
];

/**
 * Collect all classes claimed by manual sections.
 * @returns {Set<string>}
 */
export function getCoveredClasses() {
  const covered = new Set();
  for (const s of sections) {
    if (s.coversClasses) {
      for (const c of s.coversClasses) covered.add(c);
    }
  }
  return covered;
}
