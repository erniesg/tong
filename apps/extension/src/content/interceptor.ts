/**
 * MAIN world script — captures YouTube caption data via XHR/fetch interception.
 * Injected via <script src="interceptor.js"> (not inline, so CSP allows it).
 *
 * Strategy:
 * 1. Monkey-patch XHR/fetch to capture timedtext responses
 * 2. When content script requests captions for a language:
 *    a. Ensure CC is OFF first (so any track change is clean)
 *    b. Set the desired track via player API
 *    c. Turn CC ON → YouTube fetches timedtext for that track
 *    d. Capture the response via our patches
 *    e. Restore CC to its original state
 * 3. Dispatch captured data to content script via CustomEvents
 */

(function () {
  const capturedLanguages = new Set<string>();
  let requestedLang: string | null = null;
  let autoTriggerVersion = 0;

  // === Patch XMLHttpRequest ===
  const OrigXHR = window.XMLHttpRequest;
  const origOpen = OrigXHR.prototype.open;

  OrigXHR.prototype.open = function (
    this: XMLHttpRequest & { _tongUrl?: string },
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('/api/timedtext') || urlStr.includes('timedtext')) {
      this._tongUrl = urlStr;
    }
    return origOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
  };

  const origSend = OrigXHR.prototype.send;
  OrigXHR.prototype.send = function (
    this: XMLHttpRequest & { _tongUrl?: string },
    body?: XMLHttpRequestBodyInit | Document | null,
  ) {
    const savedUrl = this._tongUrl;
    if (savedUrl) {
      this.addEventListener('load', function () {
        if (this.responseText && this.responseText.length > 0) {
          try {
            const u = new URL(savedUrl);
            const lang = u.searchParams.get('lang') || 'unknown';
            const fmt = u.searchParams.get('fmt') || 'xml';

            console.log('[Tong Interceptor] Captured XHR caption:', lang, fmt, this.responseText.length, 'bytes');
            capturedLanguages.add(lang);

            window.dispatchEvent(
              new CustomEvent('tong-caption-intercepted', {
                detail: { lang, data: this.responseText, format: fmt },
              })
            );
          } catch (e) {
            // ignore
          }
        }
      });
    }
    return origSend.call(this, body);
  };

  // === Patch fetch ===
  const origFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const url =
      typeof args[0] === 'string'
        ? args[0]
        : args[0] instanceof Request
          ? args[0].url
          : args[0]?.toString() || '';

    const response = await origFetch.apply(this, args);

    if (url.includes('/api/timedtext') || url.includes('timedtext')) {
      try {
        const clone = response.clone();
        const text = await clone.text();
        if (text && text.length > 10) {
          const u = new URL(url);
          const lang = u.searchParams.get('lang') || 'unknown';
          const fmt = u.searchParams.get('fmt') || 'xml';

          console.log('[Tong Interceptor] Captured fetch caption:', lang, fmt, text.length, 'bytes');
          capturedLanguages.add(lang);

          window.dispatchEvent(
            new CustomEvent('tong-caption-intercepted', {
              detail: { lang, data: text, format: fmt },
            })
          );
        }
      } catch (e) {
        // ignore
      }
    }

    return response;
  };

  // === Hide/show native captions and settings menu during automation ===
  function addHideStyle() {
    if (!document.getElementById('tong-temp-hide-cc')) {
      const style = document.createElement('style');
      style.id = 'tong-temp-hide-cc';
      style.textContent = `
        .ytp-caption-window-container { display: none !important; }
        .ytp-settings-menu { opacity: 0 !important; pointer-events: auto !important; }
      `;
      document.head.appendChild(style);
    }
  }

  function removeHideStyle() {
    setTimeout(() => {
      document.getElementById('tong-temp-hide-cc')?.remove();
    }, 200);
  }

  // === Get caption tracks from all available sources ===
  function getCaptionTracks(): { playerTracks: any[]; fullTracks: any[] } {
    const player = document.getElementById('movie_player') as any;
    let playerTracks: any[] = [];
    let fullTracks: any[] = [];

    try {
      playerTracks = player?.getOption?.('captions', 'tracklist') || [];
    } catch (_e) { /* ignore */ }

    // Try player.getPlayerResponse first (works on SPA nav)
    try {
      const resp = player?.getPlayerResponse?.();
      fullTracks = resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    } catch (_e) { /* ignore */ }

    // Fallback to ytInitialPlayerResponse (works on fresh load)
    if (fullTracks.length === 0) {
      try {
        const pr = (window as any).ytInitialPlayerResponse;
        fullTracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      } catch (_e) { /* ignore */ }
    }

    return { playerTracks, fullTracks };
  }

  // === Trigger YouTube to fetch captions via CC toggle ===
  // Direct fetch never works (POT tokens — see docs/EXTENSION_DEBUGGING_LEARNINGS.md).
  // We must make YouTube's own code issue the request so our XHR/fetch patches capture it.
  function triggerCaptionFetch(langCode?: string) {
    const player = document.getElementById('movie_player') as any;
    if (!player) {
      console.warn('[Tong Interceptor] No movie_player found');
      return;
    }

    const ccBtn = document.querySelector('.ytp-subtitles-button') as HTMLElement;
    if (!ccBtn) {
      console.warn('[Tong Interceptor] No CC button found');
      return;
    }

    // Load captions module first
    try { player.loadModule('captions'); } catch (_e) { /* ignore */ }

    const { playerTracks, fullTracks } = getCaptionTracks();
    console.log('[Tong Interceptor] Player tracks:', playerTracks.map((t: any) => t.languageCode));
    console.log('[Tong Interceptor] Full tracks (inc ASR):', fullTracks.map((t: any) => t.languageCode));

    triggerCaptionViaCC(langCode, playerTracks, fullTracks);
  }

  // === CC toggle approach — the ONLY reliable way to get captions ===
  // YouTube requires POT tokens that can't be replicated. We must trigger
  // YouTube's own code to fetch captions, then intercept the response.
  function triggerCaptionViaCC(langCode: string | undefined, playerTracks: any[], fullTracks: any[]) {
    const player = document.getElementById('movie_player') as any;
    const ccBtn = document.querySelector('.ytp-subtitles-button') as HTMLElement;
    if (!player || !ccBtn) return;

    const wasOn = ccBtn.getAttribute('aria-pressed') === 'true';
    addHideStyle();

    // STEP 1: Ensure CC is OFF so we start from a clean state.
    if (wasOn) {
      console.log('[Tong Interceptor] CC is on, turning off first...');
      ccBtn.click(); // turn off
    }

    // STEP 2: Wait for CC to fully deactivate, then set the desired track and turn CC on.
    setTimeout(() => {
      if (langCode) {
        // First try the player's own tracklist (these are real internal track objects)
        let target = playerTracks.find((t: any) => t.languageCode === langCode);

        if (!target) {
          // Re-query after loadModule — sometimes player tracklist updates
          try {
            const freshTracks = player.getOption('captions', 'tracklist') || [];
            target = freshTracks.find((t: any) => t.languageCode === langCode);
            if (target) {
              console.log('[Tong Interceptor] Found', langCode, 'in refreshed player tracklist');
            }
          } catch (_e) { /* ignore */ }
        }

        if (!target) {
          // Pass the COMPLETE raw track object from captionTracks (includes baseUrl,
          // vssId, kind, etc.). YouTube's internal setOption may need baseUrl to know
          // where to fetch ASR caption data from.
          const fullTarget = fullTracks.find((t: any) => t.languageCode === langCode);
          if (fullTarget) {
            console.log('[Tong Interceptor] Using full captionTrack object for', langCode,
              'kind:', fullTarget.kind || 'unknown', 'hasBaseUrl:', !!fullTarget.baseUrl);
            target = { ...fullTarget };
          }
        }

        if (target) {
          console.log('[Tong Interceptor] Setting track to:', langCode,
            'kind:', target.kind || 'standard', 'vssId:', target.vssId || 'none');
          try {
            player.setOption('captions', 'track', target);
          } catch (_e) {
            console.warn('[Tong Interceptor] setOption failed for', langCode);
          }
        } else {
          console.warn('[Tong Interceptor] No track found for', langCode, 'in any source');
        }
      }

      // STEP 3: Turn CC ON — this triggers YouTube to fetch timedtext for the set track.
      console.log('[Tong Interceptor] Turning CC on to trigger caption fetch...');
      ccBtn.click(); // turn on

      // STEP 4: Wait for our XHR/fetch patch to capture the response.
      waitForCapture(() => {
        // STEP 5: Restore CC to original state.
        if (!wasOn && ccBtn.getAttribute('aria-pressed') === 'true') {
          ccBtn.click(); // turn back off
        }
        removeHideStyle();
      }, 0, langCode);
    }, 400);
  }

  /**
   * Poll until the requested language is captured (or timeout), then call the callback.
   * If the standard CC toggle doesn't capture the language, falls back to the
   * settings menu approach (which works for ASR tracks).
   */
  function waitForCapture(onDone: () => void, attempt = 0, lang?: string | null, triedMenu = false) {
    const done = lang ? capturedLanguages.has(lang) : capturedLanguages.size > 0;
    if (done) {
      console.log('[Tong Interceptor] Caption data captured successfully for:', lang ?? 'any');
      onDone();
      return;
    }
    // After ~8 seconds (40 * 200ms), try the settings menu for the specific language
    if (attempt > 40 && lang && !triedMenu) {
      console.log('[Tong Interceptor] CC toggle did not capture', lang, '— trying settings menu...');
      switchTrackViaSettingsMenu(lang).then((success) => {
        if (success) {
          // Settings menu clicked — YouTube should fetch the new track.
          // Poll again with triedMenu=true so we don't re-enter this branch.
          waitForCapture(onDone, 0, lang, true);
        } else {
          console.warn('[Tong Interceptor] Settings menu fallback failed for:', lang);
          onDone();
        }
      });
      return;
    }
    // Give up after ~15 seconds total (75 * 200ms) or ~15s after menu attempt
    if (attempt > 75) {
      console.warn('[Tong Interceptor] Timed out waiting for caption data:', lang ?? 'any');
      onDone();
      return;
    }
    setTimeout(() => waitForCapture(onDone, attempt + 1, lang, triedMenu), 200);
  }

  // === Settings menu fallback for ASR track switching ===
  // When player.setOption('captions', 'track', ...) fails for ASR tracks,
  // we programmatically navigate YouTube's settings panel to select the track.
  function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  const LANG_NAMES: Record<string, string[]> = {
    ko: ['korean', '한국어'],
    ja: ['japanese', '日本語'],
    zh: ['chinese', '中文'],
    en: ['english', '영어'],
    vi: ['vietnamese', 'tiếng việt'],
    th: ['thai', 'ภาษาไทย'],
    id: ['indonesian', 'bahasa indonesia'],
  };

  async function switchTrackViaSettingsMenu(langCode: string): Promise<boolean> {
    const settingsBtn = document.querySelector('.ytp-settings-button') as HTMLElement;
    if (!settingsBtn) return false;

    try {
      // 1. Open settings panel
      settingsBtn.click();
      await sleep(400);

      // 2. Find the subtitles/CC menu item
      const menuItems = document.querySelectorAll('.ytp-menuitem');
      let subtitlesItem: HTMLElement | null = null;
      for (const item of menuItems) {
        const label = (item.querySelector('.ytp-menuitem-label')?.textContent || '').toLowerCase();
        if (label.includes('subtitle') || label.includes('자막') || label.includes('caption') || label.includes('cc')) {
          subtitlesItem = item as HTMLElement;
          break;
        }
      }

      if (!subtitlesItem) {
        console.log('[Tong Interceptor] No subtitles menu item found');
        settingsBtn.click(); // close
        return false;
      }

      // 3. Click to open subtitles submenu
      subtitlesItem.click();
      await sleep(400);

      // 4. Find the track matching langCode
      const trackItems = document.querySelectorAll('.ytp-menuitem');
      const baseLang = langCode.split('-')[0];
      const names = LANG_NAMES[baseLang] || LANG_NAMES[langCode] || [langCode];

      for (const item of trackItems) {
        const label = (item.querySelector('.ytp-menuitem-label')?.textContent || '').toLowerCase();
        // Match by language name or code (e.g., "korean (auto-generated)" or "한국어(자동 생성)")
        const matches = names.some(n => label.includes(n)) || label.startsWith(langCode);
        if (matches) {
          console.log('[Tong Interceptor] Settings menu: selecting track:', label);
          (item as HTMLElement).click();
          await sleep(300);
          // Close the settings panel
          settingsBtn.click();
          return true;
        }
      }

      console.log('[Tong Interceptor] Settings menu: no track found for', langCode,
        'among', Array.from(trackItems).map(i => i.querySelector('.ytp-menuitem-label')?.textContent).join(', '));
      // Close the settings panel
      const backBtn = document.querySelector('.ytp-panel-back-button') as HTMLElement;
      if (backBtn) backBtn.click();
      await sleep(200);
      settingsBtn.click();
      return false;
    } catch (e) {
      console.warn('[Tong Interceptor] Settings menu error:', e);
      try { settingsBtn.click(); } catch (_) { /* ignore */ }
      return false;
    }
  }

  // === Handle explicit requests from content script ===
  window.addEventListener('tong-request-captions', ((event: CustomEvent) => {
    const langCode = event.detail?.lang;
    console.log('[Tong Interceptor] Caption request for:', langCode || 'default');
    if (langCode) {
      capturedLanguages.delete(langCode); // reset only the requested language
    } else {
      capturedLanguages.clear();
    }
    requestedLang = langCode || null;
    triggerCaptionFetch(langCode);
  }) as EventListener);

  // === Auto-trigger on page load — direct-fetch ALL caption tracks ===
  function autoTriggerOnReady() {
    if (!window.location.pathname.startsWith('/watch')) return;

    const myVersion = ++autoTriggerVersion; // dedup: only latest trigger proceeds
    let attempts = 0;
    const check = () => {
      if (myVersion !== autoTriggerVersion) return; // superseded by newer trigger
      attempts++;
      if (attempts > 60) return;

      const player = document.getElementById('movie_player') as any;
      if (!player) {
        setTimeout(check, 500);
        return;
      }

      // Player state: 1=playing, 2=paused, 3=buffering — all mean "ready"
      let state = -1;
      try { state = player.getPlayerState(); } catch (_e) { /* ignore */ }
      if (state < 1) {
        setTimeout(check, 500);
        return;
      }

      console.log('[Tong Interceptor] Auto-triggering (player state=' + state + ')');

      // CC toggle is the ONLY way to get captions (POT tokens prevent direct fetch).
      // Just trigger a generic CC toggle — YouTube will load its default track,
      // and our XHR/fetch patches will capture the response.
      triggerCaptionFetch();
    };

    setTimeout(check, 1500);
  }

  autoTriggerOnReady();

  // Re-trigger on YouTube SPA navigation
  document.addEventListener('yt-navigate-finish', () => {
    if (window.location.pathname.startsWith('/watch')) {
      capturedLanguages.clear();
      setTimeout(() => autoTriggerOnReady(), 1000);
    }
  });

  console.log('[Tong Interceptor] Interceptors installed (auto-trigger + passive capture)');
})();
