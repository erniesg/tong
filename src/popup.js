const labelByLanguage = {
  zh: "Mandarin Chinese",
  ja: "Japanese",
  ko: "Korean"
};

async function initPopup() {
  const settings = await chrome.storage.sync.get(["targetLanguage"]);
  const language = settings.targetLanguage || "zh";
  const languageLabel = document.getElementById("languageLabel");
  languageLabel.textContent = `Current track: ${labelByLanguage[language] || "Mandarin Chinese"}`;

  const startButton = document.getElementById("startGame");
  startButton.addEventListener("click", async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL("src/game.html") });
    window.close();
  });
}

initPopup();
