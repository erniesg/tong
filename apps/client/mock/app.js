const fixture = async (name) => {
  const response = await fetch(`/packages/contracts/fixtures/${name}`);
  if (!response.ok) {
    throw new Error(`Failed to load fixture: ${name}`);
  }
  return response.json();
};

const render = async () => {
  const [
    captions,
    dictionary,
    mediaProfile,
    vocabFeed,
    gameState,
    learnSessions,
    foodScene,
    textingScene,
    objective,
  ] = await Promise.all([
    fixture("captions.enriched.sample.json"),
    fixture("dictionary.entry.sample.json"),
    fixture("player.media-profile.sample.json"),
    fixture("vocab.frequency.sample.json"),
    fixture("game.start-or-resume.sample.json"),
    fixture("learn.sessions.sample.json"),
    fixture("scene.food-hangout.sample.json"),
    fixture("scene.shanghai-texting-reward.sample.json"),
    fixture("objectives.next.sample.json"),
  ]);

  const popover = document.querySelector("#dictionary-popover");

  const captionOverlay = document.querySelector("#caption-overlay");
  captionOverlay.innerHTML = captions.segments
    .map(
      (segment) => `
      <div class="caption-line">${segment.surface}</div>
      <div class="romanized">${segment.romanized}</div>
      <div class="english">${segment.english}</div>
      <div class="tokens">
        ${segment.tokens
          .map(
            (token) => `<button class="token" data-token="${token.lemma}">${token.text}</button>`,
          )
          .join("")}
      </div>
      <div class="meta">${segment.startMs}ms - ${segment.endMs}ms</div>
    `,
    )
    .join("");

  captionOverlay.querySelectorAll(".token").forEach((button) => {
    button.addEventListener("click", () => {
      popover.classList.remove("hidden");
      popover.innerHTML = `
        <strong>${dictionary.term} (${dictionary.readings.ko})</strong>
        <p>${dictionary.meaning}</p>
        <p>ZH: ${dictionary.crossCjk.zhHans} (${dictionary.readings.zhPinyin})</p>
        <p>JA: ${dictionary.crossCjk.ja} (${dictionary.readings.jaRomaji})</p>
        <p>Examples: ${dictionary.examples.join(" • ")}</p>
      `;
    });
  });

  const signalContainer = document.querySelector("#media-signals");
  const youtube = mediaProfile.sourceBreakdown.youtube;
  const spotify = mediaProfile.sourceBreakdown.spotify;
  signalContainer.innerHTML = `
    <article class="stat-card"><strong>YouTube</strong><div>${youtube.itemsConsumed} items • ${youtube.minutes} min</div></article>
    <article class="stat-card"><strong>Spotify</strong><div>${spotify.itemsConsumed} items • ${spotify.minutes} min</div></article>
    <article class="stat-card"><strong>Top term</strong><div>${mediaProfile.learningSignals.topTerms[0].lemma}</div></article>
    <article class="stat-card"><strong>Top cluster</strong><div>${mediaProfile.learningSignals.clusterAffinities[0].label}</div></article>
  `;

  document.querySelector("#vocab-feed").innerHTML = vocabFeed.items
    .map(
      (item) =>
        `<li><strong>${item.lemma}</strong> (${item.lang}) • count ${item.count} • sources ${item.sourceCount}</li>`,
    )
    .join("");

  document.querySelector("#session-state").innerHTML = `
    <div>Session: ${gameState.sessionId}</div>
    <div>City: ${gameState.city} • Scene: ${gameState.sceneId}</div>
    <div>XP ${gameState.progression.xp} • SP ${gameState.progression.sp} • RP ${gameState.progression.rp}</div>
    <div>Objective: ${objective.objectiveId} (${objective.mode})</div>
  `;

  document.querySelector("#learn-sessions").innerHTML = learnSessions.items
    .map(
      (item) =>
        `<li><strong>${item.title}</strong><br />Objective ${item.objectiveId}<br />${item.uiTheme} • ${item.lastMessageAt}</li>`,
    )
    .join("");

  document.querySelector("#food-scene").innerHTML = foodScene.steps
    .map((step) => `<li>${step.type}: ${step.text || step.successCriteria || JSON.stringify(step.delta)}</li>`)
    .join("");

  document.querySelector("#texting-scene").innerHTML = textingScene.steps
    .map((step) => `<li>${step.type}: ${step.objective || step.unlock || step.channelStyle}</li>`)
    .join("");
};

render().catch((error) => {
  const panel = document.querySelector("main");
  panel.insertAdjacentHTML("beforeend", `<p>Failed to render mock UI: ${error.message}</p>`);
});
