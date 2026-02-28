"use client";

import { useMemo, useState } from "react";
import type { DemoData, ScriptToken, SceneStep } from "../lib/load-fixtures";

const CITY_LABELS: Record<string, string> = {
  seoul: "Seoul",
  tokyo: "Tokyo",
  shanghai: "Shanghai"
};

const LOCATION_LABELS: Record<string, string> = {
  food_street: "Food Street",
  cafe: "Cafe",
  convenience_store: "Convenience Store",
  subway_hub: "Subway Hub",
  practice_studio: "Practice Studio"
};

function formatDate(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getStepSummary(step: SceneStep) {
  if (step.type === "dialogue") {
    return step.text;
  }

  if (step.type === "exercise") {
    return `Hint: ${step.successCriteria}`;
  }

  if (step.type === "reward") {
    return `Rewards: +${step.delta.xp} XP, +${step.delta.sp} SP, +${step.delta.rp} RP`;
  }

  if (step.type === "texting_mission") {
    return step.objective;
  }

  return step.unlock.replaceAll("_", " ");
}

function scorePill(score: number) {
  const pct = Math.round(score * 100);
  return <span className="score-pill">{pct}%</span>;
}

type DemoShellProps = {
  data: DemoData;
  demoFastPath: boolean;
  autoPassChecks: boolean;
};

export function DemoShell({ data, demoFastPath, autoPassChecks }: DemoShellProps) {

  const [selectedCity, setSelectedCity] = useState(data.startOrResume.city);
  const [sessionMode, setSessionMode] = useState<"new" | "resume">("resume");
  const [learnPanel, setLearnPanel] = useState<"new" | "history">("history");
  const [selectedToken, setSelectedToken] = useState<ScriptToken | null>(
    data.captions.segments[0]?.tokens[0] ?? null
  );

  const firstSegment = data.captions.segments[0];

  const youtubeMedia = useMemo(() => {
    return data.playerMediaProfile.sourceBreakdown.youtube.topMedia.find((item) => item.embedUrl);
  }, [data.playerMediaProfile.sourceBreakdown.youtube.topMedia]);

  const spotifyMedia = useMemo(() => {
    return data.playerMediaProfile.sourceBreakdown.spotify.topMedia.find((item) => item.embedUrl);
  }, [data.playerMediaProfile.sourceBreakdown.spotify.topMedia]);

  const cityChatTheme = data.gameLoop.modeUiPolicies.learn.chatStyleByCity[selectedCity] ?? "wechat_like";

  return (
    <main className="page">
      <section className="hero card">
        <p className="eyebrow">Tong Hackathon Mock UI</p>
        <h1>Mobile-first demo flow with fixture-backed personalization</h1>
        <p>
          Run-of-show includes captions + dictionary, 72-hour signal feed, objective-specific game sessions,
          and Shanghai advanced mission rewards.
        </p>
        <div className="pill-row">
          <span className={`pill ${demoFastPath ? "pill-on" : "pill-off"}`}>
            demo_fast_path={demoFastPath ? "true" : "false"}
          </span>
          <span className={`pill ${autoPassChecks ? "pill-on" : "pill-off"}`}>
            auto_pass_checks={autoPassChecks ? "true" : "false"}
          </span>
        </div>
      </section>

      <section className="card">
        <h2>1) Caption Overlay + Dictionary Popover</h2>
        <div className="media-grid">
          <div className="video-shell">
            <iframe
              title="Korean caption demo"
              src={youtubeMedia?.embedUrl ?? "https://www.youtube.com/embed/M7lc1UVf-VE"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <div className="overlay-lanes">
              <p className="lane native">{firstSegment.surface}</p>
              <p className="lane romanized">{firstSegment.romanized}</p>
              <p className="lane english">{firstSegment.english}</p>
              <div className="token-row">
                {firstSegment.tokens.map((token) => (
                  <button
                    key={`${token.dictionaryId}-${token.text}`}
                    className={`token-btn ${selectedToken?.dictionaryId === token.dictionaryId ? "active" : ""}`}
                    onClick={() => setSelectedToken(token)}
                  >
                    {token.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <aside className="dictionary-card">
            <h3>Dictionary</h3>
            <p className="term">
              {selectedToken?.lemma ?? data.dictionary.term} ({data.dictionary.lang})
            </p>
            <p className="meaning">{data.dictionary.meaning}</p>
            <p className="label">Examples</p>
            <ul>
              {data.dictionary.examples.map((example) => (
                <li key={example}>{example}</li>
              ))}
            </ul>
            <p className="label">Cross-CJK</p>
            <div className="mini-grid">
              <span>ZH {data.dictionary.crossCjk.zhHans}</span>
              <span>JA {data.dictionary.crossCjk.ja}</span>
            </div>
            <p className="label">Readings</p>
            <div className="mini-grid">
              <span>KO {data.dictionary.readings.ko}</span>
              <span>ZH {data.dictionary.readings.zhPinyin}</span>
              <span>JA {data.dictionary.readings.jaRomaji}</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="card">
        <h2>2) Last 3 Days Personalization Signal</h2>
        <p>
          Window: {formatDate(data.vocabFrequency.windowStartIso)} to {formatDate(data.vocabFrequency.windowEndIso)}
        </p>
        <div className="stats-grid">
          <article className="stat-card">
            <h3>YouTube Learning Signal</h3>
            <p>
              {data.playerMediaProfile.sourceBreakdown.youtube.itemsConsumed} items /{" "}
              {data.playerMediaProfile.sourceBreakdown.youtube.minutes} minutes
            </p>
            <ul>
              {data.playerMediaProfile.sourceBreakdown.youtube.topMedia.map((item) => (
                <li key={item.mediaId}>
                  {item.title} ({item.lang}) - {item.minutes} min
                </li>
              ))}
            </ul>
          </article>
          <article className="stat-card">
            <h3>Spotify Learning Signal</h3>
            <p>
              {data.playerMediaProfile.sourceBreakdown.spotify.itemsConsumed} tracks /{" "}
              {data.playerMediaProfile.sourceBreakdown.spotify.minutes} minutes
            </p>
            <ul>
              {data.playerMediaProfile.sourceBreakdown.spotify.topMedia.map((item) => (
                <li key={item.mediaId}>
                  {item.title} ({item.lang}) - {item.minutes} min
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="media-grid">
          <div className="embed-card">
            <h3>YouTube Preview</h3>
            <iframe
              title="YouTube top media"
              src={youtubeMedia?.embedUrl ?? "https://www.youtube.com/embed/aqz-KE-bpKQ"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="embed-card">
            <h3>Spotify Preview</h3>
            <iframe
              title="Spotify top media"
              src={
                spotifyMedia?.embedUrl ??
                "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC?utm_source=generator"
              }
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          </div>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <h3>Frequency Feed (reinforcement)</h3>
            <ul>
              {data.vocabFrequency.items.map((item) => (
                <li key={`${item.lemma}-${item.lang}`}>
                  <strong>{item.lemma}</strong> ({item.lang}) - {item.count} hits across {item.sourceCount} sources
                </li>
              ))}
            </ul>
          </article>
          <article className="stat-card">
            <h3>Cross-source Learning Signals</h3>
            <ul>
              {data.playerMediaProfile.learningSignals.topTerms.map((term) => (
                <li key={`${term.lemma}-${term.lang}`}>
                  {term.lemma} ({term.lang}) from {term.dominantSource} {scorePill(term.weightedScore)}
                </li>
              ))}
            </ul>
            <div className="cluster-row">
              {data.playerMediaProfile.learningSignals.clusterAffinities.map((cluster) => (
                <span className="cluster" key={cluster.clusterId}>
                  {cluster.label} {scorePill(cluster.score)}
                </span>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="card">
        <h2>3) Start/Resume + First Hangout Scene</h2>
        <div className="city-row" role="tablist" aria-label="City map tabs">
          {data.gameLoop.cities.map((city) => (
            <button
              key={city}
              className={`city-btn ${selectedCity === city ? "active" : ""}`}
              onClick={() => setSelectedCity(city)}
            >
              {CITY_LABELS[city] ?? city}
            </button>
          ))}
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <h3>Game Session Bootstrap</h3>
            <p>Session: {data.startOrResume.sessionId}</p>
            <p>Default city: {CITY_LABELS[data.startOrResume.city]}</p>
            <p>Scene: {data.startOrResume.sceneId}</p>
            <div className="pill-row">
              <button
                className={`pill-button ${sessionMode === "new" ? "active" : ""}`}
                onClick={() => setSessionMode("new")}
              >
                Start new game
              </button>
              <button
                className={`pill-button ${sessionMode === "resume" ? "active" : ""}`}
                onClick={() => setSessionMode("resume")}
              >
                Resume game
              </button>
            </div>
            <p>
              Active mode: <strong>{sessionMode}</strong>
            </p>
          </article>

          <article className="stat-card">
            <h3>Progress Currencies</h3>
            <div className="currency-row">
              <span>XP {data.startOrResume.progression.xp}</span>
              <span>SP {data.startOrResume.progression.sp}</span>
              <span>RP {data.startOrResume.progression.rp}</span>
            </div>
            <p>Current mastery tier: {data.startOrResume.progression.currentMasteryLevel}</p>
            <p>
              Unlock loop: learn readiness -&gt; hangout validation -&gt; mission -&gt; tier unlock ({" "}
              {data.gameLoop.unlockRules.hangoutsRequiredForMission} hangouts required)
            </p>
          </article>
        </div>

        <div className="hangout-shell">
          <p className="immersive-line">
            You arrive at {CITY_LABELS[selectedCity]} {LOCATION_LABELS[data.sceneFood.location]}. Tong stays in-character
            and gives only dialogue + hints during the active scene.
          </p>
          <div className="chat-thread">
            {data.sceneFood.steps.map((step, index) => (
              <div className={`chat-bubble ${step.type === "dialogue" ? "tong" : "hint"}`} key={`${step.type}-${index}`}>
                {getStepSummary(step)}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>4) Learn Mode (objective-specific)</h2>
        <p>
          Theme: <strong>{cityChatTheme}</strong> | Supports history: {String(
            data.gameLoop.modeUiPolicies.learn.supportsHistoryView
          )} | Supports new session: {String(data.gameLoop.modeUiPolicies.learn.supportsStartNewSession)}
        </p>

        <div className="pill-row">
          <button
            className={`pill-button ${learnPanel === "new" ? "active" : ""}`}
            onClick={() => setLearnPanel("new")}
          >
            Start new session
          </button>
          <button
            className={`pill-button ${learnPanel === "history" ? "active" : ""}`}
            onClick={() => setLearnPanel("history")}
          >
            View previous sessions
          </button>
        </div>

        {learnPanel === "history" ? (
          <div className="chat-history">
            {data.learnSessions.items.map((session) => (
              <article className="history-card" key={session.learnSessionId}>
                <h3>{session.title}</h3>
                <p>Objective: {session.objectiveId}</p>
                <p>Lang: {session.lang}</p>
                <p>Last activity: {formatDate(session.lastMessageAt)}</p>
              </article>
            ))}
          </div>
        ) : (
          <article className="objective-card">
            <h3>New Session Objective: {data.objectivesNext.objectiveId}</h3>
            <p>
              Required turns: {data.objectivesNext.completionCriteria.requiredTurns} | Required accuracy:{" "}
              {Math.round(data.objectivesNext.completionCriteria.requiredAccuracy * 100)}%
            </p>
            <p className="label">Vocabulary</p>
            <div className="tag-row">
              {data.objectivesNext.coreTargets.vocabulary.map((token) => (
                <span className="tag" key={token}>
                  {token}
                </span>
              ))}
            </div>
            <p className="label">Grammar</p>
            <div className="tag-row">
              {data.objectivesNext.coreTargets.grammar.map((item) => (
                <span className="tag" key={item}>
                  {item}
                </span>
              ))}
            </div>
            <p className="label">Sentence Structures</p>
            <div className="tag-row">
              {data.objectivesNext.coreTargets.sentenceStructures.map((item) => (
                <span className="tag" key={item}>
                  {item}
                </span>
              ))}
            </div>
            <p className="label">Personalized targets (from consumed media)</p>
            <div className="tag-row">
              {data.objectivesNext.personalizedTargets.map((item) => (
                <span className="tag" key={`${item.source}-${item.lemma}`}>
                  {item.lemma} ({item.source})
                </span>
              ))}
            </div>
          </article>
        )}
      </section>

      <section className="card">
        <h2>5) Shanghai Advanced Texting Mission + Reward Unlock</h2>
        <div className="wechat-shell">
          <p className="label">Channel style: wechat_like</p>
          <div className="chat-thread">
            <div className="chat-bubble user">你到了吗？我在咖啡店门口等你。</div>
            <div className="chat-bubble tong">我到了。我们先完成任务，再去散步。</div>
            {data.sceneShanghaiReward.steps.map((step, index) => (
              <div className={`chat-bubble ${step.type === "reward_unlock" ? "reward" : "hint"}`} key={`reward-${index}`}>
                {getStepSummary(step)}
              </div>
            ))}
          </div>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <h3>Mission gate</h3>
            <p>City: {CITY_LABELS[data.sceneShanghaiReward.city]}</p>
            <p>Location: {LOCATION_LABELS[data.sceneShanghaiReward.location]}</p>
            <p>Required mastery level: {data.sceneShanghaiReward.requires?.masteryLevelAtLeast}</p>
            <p>Required relationship tier: {data.sceneShanghaiReward.requires?.relationshipTierAtLeast}</p>
            <p>
              Mission status: <strong>{autoPassChecks ? "Passed (auto)" : "Ready for manual validation"}</strong>
            </p>
          </article>
          <article className="stat-card polaroid">
            <h3>Reward unlocks</h3>
            <p>1. Video call event</p>
            <p>2. Polaroid memory collectible</p>
            <div className="polaroid-card">
              <p>SHANGHAI NIGHT CAFE</p>
              <p>Unlocked memory #01</p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
