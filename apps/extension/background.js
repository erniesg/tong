(() => {
  const LOG_PREFIX = '[TongExt][BG]';

  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }

  function warn(...args) {
    console.warn(LOG_PREFIX, ...args);
  }

  function toErrorMessage(error) {
    if (!error) return 'unknown_error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return String(error);
  }

  async function getCaptionTracks(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        const player = document.getElementById('movie_player');

        try {
          if (player && typeof player.getPlayerResponse === 'function') {
            const response = player.getPlayerResponse();
            const tracks =
              response &&
              response.captions &&
              response.captions.playerCaptionsTracklistRenderer &&
              response.captions.playerCaptionsTracklistRenderer.captionTracks;
            if (Array.isArray(tracks) && tracks.length > 0) {
              return tracks;
            }
          }
        } catch (_err) {
          // ignore
        }

        try {
          const initial = window.ytInitialPlayerResponse;
          const tracks =
            initial &&
            initial.captions &&
            initial.captions.playerCaptionsTracklistRenderer &&
            initial.captions.playerCaptionsTracklistRenderer.captionTracks;
          if (Array.isArray(tracks) && tracks.length > 0) {
            return tracks;
          }
        } catch (_err) {
          // ignore
        }

        return [];
      },
    });

    const first = Array.isArray(results) && results.length > 0 ? results[0] : null;
    const tracks = first && Array.isArray(first.result) ? first.result : [];
    return tracks;
  }

  async function fetchTextViaMainWorld(tabId, url) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [url],
      func: async (fetchUrl) => {
        try {
          const response = await fetch(fetchUrl, { credentials: 'include' });
          if (!response.ok) {
            return { ok: false, status: response.status, text: '' };
          }
          const text = await response.text();
          return { ok: true, status: response.status, text };
        } catch (error) {
          return {
            ok: false,
            status: 0,
            text: '',
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    });

    const first = Array.isArray(results) && results.length > 0 ? results[0] : null;
    return first && first.result ? first.result : { ok: false, status: 0, text: '' };
  }

  chrome.runtime.onInstalled.addListener((details) => {
    log('Service worker installed/updated:', details.reason);
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      if (!message || typeof message !== 'object') {
        return { ok: false, error: 'invalid_message' };
      }

      const tabId = sender && sender.tab ? sender.tab.id : null;
      if (!tabId) {
        return { ok: false, error: 'missing_tab_id' };
      }

      if (message.type === 'GET_YT_CAPTION_TRACKS') {
        const tracks = await getCaptionTracks(tabId);
        log('Caption tracks fetched:', tracks.length);
        return { ok: true, tracks };
      }

      if (message.type === 'FETCH_YT_SUBTITLES') {
        if (!message.url || typeof message.url !== 'string') {
          return { ok: false, error: 'missing_url' };
        }

        const result = await fetchTextViaMainWorld(tabId, message.url);
        if (!result.ok) {
          warn('Subtitle fetch failed:', result.status || 0, result.error || 'no_error_text');
          return {
            ok: false,
            error: result.error || `subtitle_fetch_failed_${result.status || 0}`,
            status: result.status || 0,
          };
        }

        log('Subtitle payload fetched:', result.text.length, 'bytes');
        return { ok: true, text: result.text };
      }

      return { ok: false, error: `unsupported_message_type_${message.type}` };
    })()
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ ok: false, error: toErrorMessage(error) });
      });

    return true;
  });

  log('Background worker ready');
})();
