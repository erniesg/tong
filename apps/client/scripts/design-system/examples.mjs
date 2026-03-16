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
    coversClasses: ['button', 'secondary', 'ghost', 'btn-go', 'btn-skip'],
    html: `
    <div class="ds-component-card">
      <div class="ds-component-label">Standard Variants</div>
      <div class="ds-component-row" style="margin-bottom: 16px;">
        <button>Primary</button>
        <button class="secondary">Secondary</button>
        <button class="ghost">Ghost</button>
        <button disabled>Disabled</button>
      </div>
      <div class="ds-component-label">Game CTAs</div>
      <div class="ds-component-row">
        <button class="btn-go">Let's go</button>
        <button class="btn-skip">Skip</button>
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

  // ── 11 Demo Access ──────────────────────────────────────────
  {
    id: 'demo-access',
    number: '11',
    category: 'Components',
    title: 'Demo Access Bar',
    description:
      'Sticky password bar shown in demo/preview mode.',
    type: 'manual',
    coversClasses: ['demo-access-bar', 'demo-access-row', 'demo-access-hint'],
    html: `
    <div class="ds-component-card">
      <div class="demo-access-bar" style="position: relative;">
        <div class="demo-access-row">
          <span style="font-size: 13px; font-weight: 600;">Demo access</span>
          <input type="password" placeholder="Enter password" style="max-width: 180px;">
          <button style="font-size: 12px; padding: 6px 12px;">Unlock</button>
        </div>
        <p class="demo-access-hint">Contact us for the demo password.</p>
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
        <div style="border-radius: 14px; padding: 10px 12px; font-size: 14px; background: #f8f1ff; border: 1px solid #dfd0f5;">
          <strong style="font-size: 12px;">Ha-eun</strong><br>
          <span class="korean">&#xC5B4;&#xC11C; &#xC624;&#xC138;&#xC694;!</span>
        </div>
        <div style="border-radius: 14px; padding: 10px 12px; font-size: 14px; background: #fff2e6; border: 1px solid #f3d4b8; margin-left: auto;">
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

  // ── 18 Game Shell & HUD ──────────────────────────────────
  {
    id: 'game-shell',
    number: '18',
    category: 'Game Mode',
    title: 'Game Shell & HUD',
    description:
      'Top-level game container and heads-up display for scores and location.',
    type: 'manual',
    coversClasses: [
      'game-frame',
      'game-shell',
      'scene-root',
      'scene-hud',
      'scene-hud-location',
      'scene-hud-dot',
      'scene-hud-scores',
      'scene-hud-score',
    ],
    html: `
    <div class="ds-component-card" style="background: #0d0d1a; color: #eee; border-radius: 18px; padding: 0; overflow: hidden;">
      <div style="position: relative; min-height: 120px;">
        <div class="scene-hud" style="position: relative; background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent);">
          <div>
            <span class="scene-hud-location">Hongdae</span>
            <span class="scene-hud-dot">&middot;</span>
            <span class="scene-hud-location">Cafe</span>
          </div>
          <div class="scene-hud-scores">
            <span class="scene-hud-score"><b>12</b> XP</span>
            <span class="scene-hud-score"><b>3</b> Streak</span>
          </div>
        </div>
        <div style="padding: 12px; color: rgba(255,255,255,0.5); font-size: 13px;">
          .game-frame &gt; .scene-root &gt; .scene-hud
        </div>
      </div>
    </div>`,
  },

  // ── 19 Tong Entry (Opening) ──────────────────────────────
  {
    id: 'tg-entry',
    number: '19',
    category: 'Game Mode',
    title: 'Tong Entry (Opening)',
    description:
      'Ambient background, phone container, and branded entry panel.',
    type: 'manual',
    coversClasses: [
      'tg-shell',
      'tg-stage',
      'tg-ambient',
      'tg-blob',
      'tg-blob-a',
      'tg-blob-b',
      'tg-scrim',
      'tg-phone',
      'tg-phone-entry',
      'tg-opening-video-wrap',
      'tg-opening-video',
      'tg-opening-loading',
      'tg-text-link',
      'tg-entry-panel',
      'tg-logo',
      'tg-brand',
      'tg-title',
      'tg-title-accent',
      'tg-copy',
      'tg-actions',
      'tg-city-list',
    ],
    html: `
    <div class="ds-component-card" style="background: #020717; border-radius: 18px; padding: 20px; color: #eef2fa;">
      <div style="position: relative; max-width: 300px; margin: 0 auto;">
        <div style="border: 1px solid rgba(255,255,255,0.14); border-radius: 28px; background: linear-gradient(180deg, #151d3a, #10172f); padding: 22px 20px; text-align: center;">
          <div style="width: 64px; height: 64px; margin: 0 auto 8px; border-radius: 50%; background: linear-gradient(135deg, #f3d36a, #e4b43a); display: grid; place-items: center; font-size: 28px; font-weight: 800; color: #1d2032;">T</div>
          <p class="tg-brand">TONG</p>
          <h1 class="tg-title" style="font-size: 36px;">Learn<br><span class="tg-title-accent">Korean</span></h1>
          <p class="tg-copy">Immersive language learning through conversation</p>
          <div class="tg-actions" style="margin-top: 12px;">
            <button style="flex: 1;">Start</button>
            <button class="secondary" style="flex: 1; border-color: rgba(255,255,255,0.2); color: #eee;">Sign in</button>
          </div>
          <div class="tg-city-list" style="margin-top: 12px;">
            <span>Seoul</span><span>Tokyo</span><span>Shanghai</span>
          </div>
        </div>
      </div>
    </div>`,
  },

  // ── 20 Tong Onboarding ───────────────────────────────────
  {
    id: 'tg-onboarding',
    number: '20',
    category: 'Game Mode',
    title: 'Tong Onboarding',
    description:
      'Language proficiency sliders, preset buttons, and status messages.',
    type: 'manual',
    coversClasses: [
      'tg-onboarding-panel',
      'tg-onboarding-avatar',
      'tg-onboarding-line',
      'tg-onboarding-line-strong',
      'tg-slider-card',
      'tg-slider-row',
      'tg-slider-head',
      'tg-preset-row',
      'tg-status',
      'tg-error',
    ],
    html: `
    <div class="ds-component-card" style="background: #10172f; border-radius: 18px; padding: 0; overflow: hidden; max-width: 360px; color: #eef2fa;">
      <div class="tg-onboarding-panel">
        <div class="tg-onboarding-avatar">T</div>
        <p class="tg-onboarding-line">How much <span class="tg-onboarding-line-strong">Korean</span> do you know?</p>
        <div class="tg-slider-card">
          <header>
            <p>Korean</p>
            <span>Beginner</span>
          </header>
          <div class="tg-slider-row">
            <div class="tg-slider-head">
              <strong>Korean</strong>
              <span>1 / 5</span>
            </div>
            <input type="range" min="1" max="5" value="1" style="width: 100%;">
            <small>No experience</small>
          </div>
        </div>
        <div class="tg-preset-row">
          <button class="secondary" style="font-size: 12px; padding: 8px; border-color: rgba(255,255,255,0.2); color: #eee;">Complete Beginner</button>
          <button class="secondary" style="font-size: 12px; padding: 8px; border-color: rgba(255,255,255,0.2); color: #eee;">Some Basics</button>
          <button class="secondary" style="font-size: 12px; padding: 8px; border-color: rgba(255,255,255,0.2); color: #eee;">Conversational</button>
        </div>
        <p class="tg-status">Ready to begin</p>
      </div>
    </div>`,
  },

  // ── 21 Tong Playing Shell ────────────────────────────────
  {
    id: 'tg-playing',
    number: '21',
    category: 'Game Mode',
    title: 'Tong Playing Shell',
    description:
      'In-game header, world sheet, scene body, and footer status.',
    type: 'manual',
    coversClasses: [
      'tg-playing-shell',
      'tg-stage-playing',
      'tg-phone-playing',
      'tg-scene-header',
      'tg-scene-kicker',
      'tg-scene-title',
      'tg-scene-actions',
      'tg-scene-body',
      'tg-chip',
      'active',
      'tg-world-sheet',
      'tg-world-row',
      'tg-city-pill',
      'tg-location-pill',
      'tg-footer-status',
      'tg-learn-panel',
      'tg-learn-header',
      'tg-learn-message',
      'tg-learn-list',
      'tg-learn-item',
    ],
    html: `
    <div class="ds-component-card" style="background: #000; border-radius: 18px; padding: 0; overflow: hidden; max-width: 360px;">
      <div style="background: linear-gradient(180deg, rgba(11,22,49,0.96), rgba(11,22,49,0.78)); border-bottom: 1px solid rgba(255,255,255,0.12); padding: 10px 14px 8px; color: #f3f7ff;">
        <p class="tg-scene-kicker">Hangout</p>
        <span class="tg-scene-title" style="font-size: 22px;">Hongdae</span>
        <div class="tg-scene-actions" style="margin-top: 6px;">
          <button class="tg-chip active">Chat</button>
          <button class="tg-chip">Learn</button>
        </div>
      </div>
      <div style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(8,16,37,0.94); display: flex; gap: 8px;">
        <button class="tg-city-pill active">Seoul</button>
        <button class="tg-location-pill">Cafe</button>
        <button class="tg-location-pill">Street</button>
      </div>
      <div style="padding: 8px 12px; background: rgba(10,17,34,0.94); border-top: 1px solid rgba(255,255,255,0.12);">
        <p style="margin: 0; font-size: 11px; color: rgba(220,228,243,0.82);">Greet Ha-eun at the cafe</p>
      </div>
    </div>`,
  },

  // ── 22 VN Dialogue ───────────────────────────────────────
  {
    id: 'vn-dialogue',
    number: '22',
    category: 'Game Mode',
    title: 'VN Dialogue',
    description:
      'Visual-novel subtitle overlay for character speech.',
    type: 'manual',
    coversClasses: [
      'dialogue-subtitle',
      'dialogue-speaker',
      'dialogue-text',
      'dialogue-translation',
      'dialogue-continue',
      'dialogue-area',
      'dialogue-line',
      'muted',
      'typewriter-cursor',
    ],
    html: `
    <div class="ds-component-card" style="background: #1a1a2e; border-radius: 18px; padding: 0; overflow: hidden; min-height: 180px; position: relative;">
      <div style="position: absolute; inset: 0; background: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22/>') center/cover; background-color: #2a2a4e;"></div>
      <div class="dialogue-subtitle" style="position: absolute; bottom: 0; left: 0; right: 0;">
        <div class="dialogue-speaker" style="color: #f0c040;">HA-EUN</div>
        <div class="dialogue-text">&#xC548;&#xB155;&#xD558;&#xC138;&#xC694;! &#xC624;&#xB298; &#xBB50; &#xD560; &#xAC70;&#xC608;&#xC694;?</div>
        <div class="dialogue-translation">Hello! What are you going to do today?</div>
        <div class="dialogue-continue">Tap to continue</div>
      </div>
    </div>`,
  },

  // ── 23 Proficiency Gauge ─────────────────────────────────
  {
    id: 'proficiency',
    number: '23',
    category: 'Game Mode',
    title: 'Proficiency Gauge',
    description:
      'Language level sliders with tick marks and CEFR mapping.',
    type: 'manual',
    coversClasses: [
      'proficiency-panel',
      'proficiency-lang',
      'proficiency-lang-header',
      'proficiency-lang-name',
      'proficiency-lang-level',
      'proficiency-slider',
      'proficiency-ticks',
      'proficiency-tick',
      'proficiency-tick-dot',
      'proficiency-tick-num',
      'proficiency-tick-label',
      'proficiency-level-map',
      'proficiency-level-tag',
      'proficiency-level-question',
    ],
    html: `
    <div class="ds-component-card" style="max-width: 400px;">
      <div class="proficiency-panel" style="animation: none;">
        <div class="proficiency-lang">
          <div class="proficiency-lang-header">
            <span class="proficiency-lang-name">Korean</span>
            <span class="proficiency-lang-level">Beginner</span>
          </div>
          <input type="range" class="proficiency-slider" min="0" max="4" value="1">
          <div class="proficiency-ticks">
            <div class="proficiency-tick">
              <div class="proficiency-tick-dot"></div>
              <div class="proficiency-tick-num">0</div>
              <div class="proficiency-tick-label">None</div>
            </div>
            <div class="proficiency-tick active">
              <div class="proficiency-tick-dot"></div>
              <div class="proficiency-tick-num">1</div>
              <div class="proficiency-tick-label">Basic</div>
            </div>
            <div class="proficiency-tick">
              <div class="proficiency-tick-dot"></div>
              <div class="proficiency-tick-num">2</div>
              <div class="proficiency-tick-label">Elementary</div>
            </div>
            <div class="proficiency-tick">
              <div class="proficiency-tick-dot"></div>
              <div class="proficiency-tick-num">3</div>
              <div class="proficiency-tick-label">Intermediate</div>
            </div>
            <div class="proficiency-tick">
              <div class="proficiency-tick-dot"></div>
              <div class="proficiency-tick-num">4</div>
              <div class="proficiency-tick-label">Advanced</div>
            </div>
          </div>
          <div class="proficiency-level-map">
            <span class="proficiency-level-tag">TOPIK I</span>
            <span class="proficiency-level-question">Can you read Hangul?</span>
          </div>
        </div>
      </div>
    </div>`,
  },

  // ── 24 Chat Messaging ────────────────────────────────────
  {
    id: 'chat-messaging',
    number: '24',
    category: 'Game Mode',
    title: 'Chat Messaging',
    description:
      'Themed messaging UI with city skins (KakaoTalk, LINE, WeChat).',
    type: 'manual',
    coversClasses: [
      'learn-chat-container',
      'learn-chat-scroll',
      'chat-row',
      'chat-row--left',
      'chat-row--right',
      'chat-row__avatar',
      'chat-row__body',
      'chat-row__name',
      'msg-bubble',
      'msg-bubble--npc',
      'msg-bubble--user',
      'bubble-tail-left',
      'bubble-tail-right',
      'bubble-tail-left-green',
      'bubble-tail-left-red',
    ],
    html: `
    <div class="ds-component-card" data-city-skin="seoul" style="padding: 0; overflow: hidden; border-radius: 18px; max-width: 360px;">
      <div class="learn-chat-container" style="height: 240px;">
        <div class="learn-chat-scroll">
          <div class="chat-row chat-row--left">
            <div class="chat-row__avatar">&#x1F425;</div>
            <div class="chat-row__body">
              <div class="chat-row__name">Ha-eun</div>
              <div class="msg-bubble msg-bubble--npc bubble-tail-left">
                <span class="korean">&#xC548;&#xB155;&#xD558;&#xC138;&#xC694;!</span>
              </div>
            </div>
          </div>
          <div class="chat-row chat-row--right">
            <div class="chat-row__body">
              <div class="msg-bubble msg-bubble--user bubble-tail-right">
                <span class="korean">&#xC548;&#xB155;!</span>
              </div>
            </div>
          </div>
          <div class="chat-row chat-row--left">
            <div class="chat-row__avatar">&#x1F425;</div>
            <div class="chat-row__body">
              <div class="msg-bubble msg-bubble--npc bubble-tail-left-green" style="background: var(--msg-correct); color: #fff;">
                Correct!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`,
  },

  // ── 25 Exercises ─────────────────────────────────────────
  {
    id: 'exercises',
    number: '25',
    category: 'Game Mode',
    title: 'Exercises',
    description:
      'Interactive exercise types: fill-blank, pronunciation select, sentence builder.',
    type: 'manual',
    coversClasses: [
      'exercise-card',
      'exercise-modal-backdrop',
      'exercise-modal-backdrop--dismissing',
      'exercise-modal-content',
      'exercise-modal-content--dismissing',
      'fill-blank__sentence',
      'fill-blank__blank',
      'fill-blank__options',
      'fill-blank__grammar-note',
      'pron-select__target',
      'pron-select__options',
      'pron-select__option',
      'pron-select__option--selected',
      'pron-select__option--correct',
      'pron-select__option--incorrect',
      'pron-select__play-icon',
      'sentence-builder__tiles',
      'sentence-builder__tile',
      'sentence-builder__tile--placed',
      'sentence-builder__tile--answer',
    ],
    html: `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div class="ds-component-card" data-city-skin="seoul">
        <div class="ds-component-label">Fill in the Blank</div>
        <div class="fill-blank__sentence">
          &#xC800;&#xB294; <span class="fill-blank__blank">&#xD559;&#xC0DD;</span> &#xC785;&#xB2C8;&#xB2E4;
        </div>
        <div class="fill-blank__options">
          <button class="secondary" style="font-size: 13px; padding: 8px;">&#xD559;&#xC0DD;</button>
          <button class="secondary" style="font-size: 13px; padding: 8px;">&#xC120;&#xC0DD;&#xB2D8;</button>
        </div>
        <div class="fill-blank__grammar-note">Topic particle: &#xC740;/&#xB294; marks the topic of a sentence.</div>
      </div>
      <div class="ds-component-card" data-city-skin="seoul">
        <div class="ds-component-label">Sentence Builder</div>
        <div class="sentence-builder__tiles" style="min-height: 44px; margin-bottom: 10px;">
          <span class="sentence-builder__tile sentence-builder__tile--answer">&#xC800;&#xB294;</span>
          <span class="sentence-builder__tile sentence-builder__tile--answer">&#xD559;&#xC0DD;</span>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          <span class="sentence-builder__tile sentence-builder__tile--placed">&#xC800;&#xB294;</span>
          <span class="sentence-builder__tile">&#xC785;&#xB2C8;&#xB2E4;</span>
          <span class="sentence-builder__tile sentence-builder__tile--placed">&#xD559;&#xC0DD;</span>
        </div>
      </div>
    </div>
    <div class="ds-component-card" data-city-skin="seoul" style="margin-top: 16px; max-width: 300px;">
      <div class="ds-component-label">Pronunciation Select</div>
      <div class="pron-select__target">&#xD55C;</div>
      <div class="pron-select__options">
        <button class="pron-select__option pron-select__option--correct">
          <span class="pron-select__play-icon">&#x25B6;</span>
          <span>han</span>
        </button>
        <button class="pron-select__option">
          <span class="pron-select__play-icon">&#x25B6;</span>
          <span>hun</span>
        </button>
      </div>
    </div>`,
  },

  // ── 26 Teaching & Feedback ───────────────────────────────
  {
    id: 'teaching-feedback',
    number: '26',
    category: 'Game Mode',
    title: 'Teaching & Feedback',
    description:
      'Teaching cards for vocabulary and feedback bubbles for exercise results.',
    type: 'manual',
    coversClasses: [
      'teaching-card',
      'teaching-card__title',
      'teaching-card__grid',
      'teaching-card__item',
      'teaching-card__char',
      'teaching-card__roman',
      'feedback-bubble',
      'feedback-bubble--correct',
      'feedback-bubble--incorrect',
      'menu-choices',
      'menu-choices__btn',
      'menu-choices__btn--selected',
    ],
    html: `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;" data-city-skin="seoul">
      <div class="ds-component-card" style="padding: 0;">
        <div class="teaching-card" style="max-width: none;">
          <div class="teaching-card__title">Basic Vowels</div>
          <div class="teaching-card__grid">
            <div class="teaching-card__item">
              <span class="teaching-card__char">&#xC544;</span>
              <span class="teaching-card__roman">a</span>
            </div>
            <div class="teaching-card__item">
              <span class="teaching-card__char">&#xC5B4;</span>
              <span class="teaching-card__roman">eo</span>
            </div>
            <div class="teaching-card__item">
              <span class="teaching-card__char">&#xC624;</span>
              <span class="teaching-card__roman">o</span>
            </div>
            <div class="teaching-card__item">
              <span class="teaching-card__char">&#xC6B0;</span>
              <span class="teaching-card__roman">u</span>
            </div>
          </div>
        </div>
      </div>
      <div class="ds-component-card">
        <div class="ds-component-label">Feedback Bubbles</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="feedback-bubble feedback-bubble--correct">Great job! That's correct.</div>
          <div class="feedback-bubble feedback-bubble--incorrect">Not quite. Try again!</div>
        </div>
        <div class="ds-component-label" style="margin-top: 12px;">Menu Choices</div>
        <div class="menu-choices">
          <button class="menu-choices__btn menu-choices__btn--selected">Greetings</button>
          <button class="menu-choices__btn">Food</button>
          <button class="menu-choices__btn">Directions</button>
          <button class="menu-choices__btn">Shopping</button>
        </div>
      </div>
    </div>`,
  },

  // ── 27 Session UI ────────────────────────────────────────
  {
    id: 'session-ui',
    number: '27',
    category: 'Game Mode',
    title: 'Session UI',
    description:
      'Session picker, summary, and typing indicator.',
    type: 'manual',
    coversClasses: [
      'session-picker',
      'session-picker__header',
      'session-picker__title',
      'session-picker__subtitle',
      'session-picker__start-btn',
      'session-picker__list',
      'session-picker__item',
      'session-picker__item-title',
      'session-picker__item-meta',
      'session-summary',
      'session-summary__title',
      'session-summary__stats',
      'session-summary__stat',
      'session-summary__stat-value',
      'session-summary__stat-label',
      'session-summary__items',
      'session-summary__item',
      'session-summary__level-up',
      'typing-indicator',
      'typing-dot',
    ],
    html: `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;" data-city-skin="seoul">
      <div class="ds-component-card" style="padding: 0; overflow: hidden; border-radius: 18px;">
        <div class="session-picker" style="height: auto; background: var(--msg-bg, #abc1d1);">
          <div class="session-picker__header">
            <div class="session-picker__title">Choose a Lesson</div>
            <div class="session-picker__subtitle">Seoul &middot; Beginner</div>
          </div>
          <div class="session-picker__list">
            <div class="session-picker__item">
              <div class="session-picker__item-title">Greetings</div>
              <div class="session-picker__item-meta">5 min &middot; 10 words</div>
            </div>
            <div class="session-picker__item">
              <div class="session-picker__item-title">Ordering Food</div>
              <div class="session-picker__item-meta">8 min &middot; 15 words</div>
            </div>
          </div>
          <button class="session-picker__start-btn">Start Lesson</button>
        </div>
      </div>
      <div class="ds-component-card">
        <div class="session-summary" style="max-width: none;">
          <div class="session-summary__title">Session Complete!</div>
          <div class="session-summary__stats">
            <div class="session-summary__stat">
              <div class="session-summary__stat-value">8</div>
              <div class="session-summary__stat-label">Words</div>
            </div>
            <div class="session-summary__stat">
              <div class="session-summary__stat-value">85%</div>
              <div class="session-summary__stat-label">Accuracy</div>
            </div>
          </div>
          <div class="session-summary__items">
            <span class="session-summary__item">&#xC548;&#xB155;</span>
            <span class="session-summary__item">&#xAC10;&#xC0AC;</span>
            <span class="session-summary__item">&#xB9DB;&#xC788;&#xC5B4;&#xC694;</span>
          </div>
          <div class="session-summary__level-up">Level Up! Beginner 2</div>
        </div>
        <div class="ds-component-label" style="margin-top: 12px;">Typing Indicator</div>
        <div class="typing-indicator" style="background: var(--msg-npc-bubble, #f0c040); border-radius: 18px; display: inline-flex;">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>`,
  },

  // ── 28 Korean Text ───────────────────────────────────────
  {
    id: 'korean-text',
    number: '28',
    category: 'Game Mode',
    title: 'Korean Text',
    description:
      'Tooltip tokens, whisper overlays, and CJK font styling.',
    type: 'manual',
    coversClasses: [
      'ko-token',
      'korean-tooltip',
      'text-ko',
      'name-plate',
      'tong-whisper',
      'tong-avatar',
      'step-list',
    ],
    html: `
    <div class="ds-component-card">
      <div class="ds-component-label">Korean Tokens (hover for tooltip)</div>
      <p style="font-size: 18px; line-height: 2;">
        <span class="ko-token" data-tooltip="hello">&#xC548;&#xB155;&#xD558;&#xC138;&#xC694;</span>!
        <span class="ko-token" data-tooltip="today">&#xC624;&#xB298;</span>
        <span class="ko-token" data-tooltip="weather (subject)">&#xB0A0;&#xC528;&#xAC00;</span>
        <span class="ko-token" data-tooltip="good">&#xC88B;&#xC544;&#xC694;</span>.
      </p>
      <div class="ds-component-label" style="margin-top: 12px;">Name Plates</div>
      <div style="display: flex; gap: 8px;">
        <span class="name-plate" style="background: #e8485c;">Ha-eun</span>
        <span class="name-plate" style="background: #f0c040; color: #1a1a2e;">Tong</span>
      </div>
      <div class="ds-component-label" style="margin-top: 12px;">Tong Whisper</div>
      <div class="tong-whisper" style="padding: 12px 14px; max-width: 320px;">
        <strong style="color: #f0c040; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;">Tong</strong>
        <p style="margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,0.88); line-height: 1.45;">Try using the formal ending &#xD569;&#xB2C8;&#xB2E4; here!</p>
      </div>
    </div>`,
  },

  // ── 29 Animation Utilities ───────────────────────────────
  {
    id: 'animation-utils',
    number: '29',
    category: 'Foundation',
    title: 'Animation Utilities',
    description:
      'CSS utility classes for entry animations on components.',
    type: 'manual',
    coversClasses: [
      'slide-up',
      'fade-in',
      'slide-in-left',
      'slide-in-right',
    ],
    html: `
    <div class="ds-component-card">
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; text-align: center;">
        <div>
          <div class="slide-up" style="background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 16px; font-size: 13px; font-weight: 600;">slide-up</div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 6px;">.slide-up</div>
        </div>
        <div>
          <div class="fade-in" style="background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 16px; font-size: 13px; font-weight: 600;">fade-in</div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 6px;">.fade-in</div>
        </div>
        <div>
          <div class="slide-in-left" style="background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 16px; font-size: 13px; font-weight: 600; position: relative; left: 50%; transform: translateX(-50%);">left</div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 6px;">.slide-in-left</div>
        </div>
        <div>
          <div class="slide-in-right" style="background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 16px; font-size: 13px; font-weight: 600; position: relative; left: 50%; transform: translateX(-50%);">right</div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 6px;">.slide-in-right</div>
        </div>
      </div>
    </div>`,
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
