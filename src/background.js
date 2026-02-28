const DEFAULT_SETTINGS = {
  targetLanguage: "zh",
  showRomanization: true,
  showTranslation: true
};

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  await chrome.storage.sync.set(merged);
});
