import { STORY } from "./data/phrases.js";

const DEFAULTS = {
  targetLanguage: "zh",
  showRomanization: true,
  showTranslation: true
};

const state = {
  language: "zh",
  sceneIndex: 0,
  xp: 0,
  affinity: 0,
  showRomanization: true,
  showTranslation: true,
  selectionLocked: false
};

const ui = {
  languageTabs: document.getElementById("languageTabs"),
  line: document.getElementById("line"),
  romanization: document.getElementById("romanization"),
  translation: document.getElementById("translation"),
  choices: document.getElementById("choices"),
  feedback: document.getElementById("feedback"),
  nextButton: document.getElementById("nextButton"),
  xp: document.getElementById("xp"),
  affinity: document.getElementById("affinity"),
  npcName: document.getElementById("npcName"),
  npcTitle: document.getElementById("npcTitle"),
  portrait: document.getElementById("portrait"),
  toggleRomanization: document.getElementById("toggleRomanization"),
  toggleTranslation: document.getElementById("toggleTranslation")
};

function currentPack() {
  return STORY[state.language];
}

function currentScene() {
  const pack = currentPack();
  return pack.scenes[state.sceneIndex];
}

function renderTabs() {
  ui.languageTabs.innerHTML = "";

  for (const [code, pack] of Object.entries(STORY)) {
    const button = document.createElement("button");
    button.textContent = pack.label;
    button.classList.toggle("active", code === state.language);
    button.addEventListener("click", () => switchLanguage(code));
    ui.languageTabs.appendChild(button);
  }
}

function renderStats() {
  ui.xp.textContent = `XP: ${state.xp}`;
  ui.affinity.textContent = `Affinity: ${state.affinity}`;
}

function renderScene() {
  const pack = currentPack();
  const scene = currentScene();

  if (!scene) {
    renderEnding();
    return;
  }

  ui.npcName.textContent = pack.npcName;
  ui.npcTitle.textContent = pack.npcTitle;
  ui.portrait.textContent = pack.npcName.slice(0, 1);

  ui.line.textContent = scene.line;
  ui.romanization.textContent = state.showRomanization ? scene.romanization : "";
  ui.translation.textContent = state.showTranslation ? scene.translation : "";

  ui.feedback.textContent = "";
  ui.feedback.className = "feedback";
  ui.nextButton.classList.add("hidden");
  state.selectionLocked = false;

  ui.choices.innerHTML = "";
  scene.choices.forEach((choice) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = choice.text;
    if (state.showRomanization || state.showTranslation) {
      const parts = [];
      if (state.showRomanization) {
        parts.push(choice.romanization);
      }
      if (state.showTranslation) {
        parts.push(choice.translation);
      }
      btn.textContent += `\n${parts.join(" / ")}`;
    }

    btn.addEventListener("click", () => choose(choice));
    ui.choices.appendChild(btn);
  });

  renderStats();
}

function choose(choice) {
  if (state.selectionLocked) {
    return;
  }

  state.selectionLocked = true;
  state.xp += choice.xpDelta;
  state.affinity += choice.affinityDelta;

  ui.feedback.textContent = `${choice.feedback} (XP +${choice.xpDelta}, Affinity ${choice.affinityDelta >= 0 ? "+" : ""}${choice.affinityDelta})`;
  ui.feedback.classList.add(choice.affinityDelta >= 0 ? "good" : "bad");

  const buttons = [...ui.choices.querySelectorAll("button")];
  buttons.forEach((button) => {
    button.disabled = true;
  });

  ui.nextButton.classList.remove("hidden");
  renderStats();
}

function renderEnding() {
  let ending = "A calm goodbye. Keep practicing and try a warmer route next run.";
  if (state.affinity >= 6) {
    ending = "Romance ending unlocked. You connected deeply through language and tone.";
  } else if (state.affinity >= 3) {
    ending = "Friendship ending unlocked. Good chemistry with room to grow.";
  }

  ui.line.textContent = "Conversation complete.";
  ui.romanization.textContent = "";
  ui.translation.textContent = ending;
  ui.choices.innerHTML = "";
  ui.feedback.textContent = "";

  ui.nextButton.textContent = "Restart";
  ui.nextButton.classList.remove("hidden");
  ui.nextButton.onclick = () => resetRun();
}

async function saveSettings() {
  await chrome.storage.sync.set({
    targetLanguage: state.language,
    showRomanization: state.showRomanization,
    showTranslation: state.showTranslation
  });
}

async function switchLanguage(code) {
  state.language = code;
  resetRun(false);
  renderTabs();
  await saveSettings();
}

function resetRun(resetLanguage = true) {
  state.sceneIndex = 0;
  state.xp = 0;
  state.affinity = 0;

  if (resetLanguage) {
    state.language = state.language || "zh";
  }

  ui.nextButton.textContent = "Next";
  ui.nextButton.onclick = handleNext;
  renderScene();
}

function handleNext() {
  state.sceneIndex += 1;
  renderScene();
}

async function init() {
  const saved = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  const merged = { ...DEFAULTS, ...saved };

  state.language = merged.targetLanguage;
  state.showRomanization = merged.showRomanization;
  state.showTranslation = merged.showTranslation;

  ui.toggleRomanization.addEventListener("click", async () => {
    state.showRomanization = !state.showRomanization;
    await saveSettings();
    renderScene();
  });

  ui.toggleTranslation.addEventListener("click", async () => {
    state.showTranslation = !state.showTranslation;
    await saveSettings();
    renderScene();
  });

  ui.nextButton.addEventListener("click", handleNext);

  renderTabs();
  resetRun(false);
}

init();
