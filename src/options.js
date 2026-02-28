const DEFAULTS = {
  targetLanguage: "zh",
  showRomanization: true,
  showTranslation: true
};

async function load() {
  const settings = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  const merged = { ...DEFAULTS, ...settings };

  document.getElementById("targetLanguage").value = merged.targetLanguage;
  document.getElementById("showRomanization").checked = merged.showRomanization;
  document.getElementById("showTranslation").checked = merged.showTranslation;
}

async function save() {
  const nextSettings = {
    targetLanguage: document.getElementById("targetLanguage").value,
    showRomanization: document.getElementById("showRomanization").checked,
    showTranslation: document.getElementById("showTranslation").checked
  };

  await chrome.storage.sync.set(nextSettings);
  const status = document.getElementById("status");
  status.textContent = "Saved.";
  setTimeout(() => {
    status.textContent = "";
  }, 1200);
}

document.getElementById("save").addEventListener("click", save);
load();
