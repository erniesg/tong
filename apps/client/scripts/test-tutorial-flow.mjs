#!/usr/bin/env node
/**
 * Dry-run the full tutorial hangout multi-turn flow.
 * Simulates what useChat does: parse tool calls, build proper message history, send next turn.
 *
 * Usage: node scripts/test-tutorial-flow.mjs [hauen|jin] [playerName]
 */

const API = 'http://localhost:3001/api/ai/hangout';
const CHARACTER = process.argv[2] || 'hauen';
const PLAYER_NAME = process.argv[3] || 'Alex';
const MAX_TURNS = 12;

const BASE_CTX = {
  playerLevel: 0,
  characterId: CHARACTER,
  city: 'seoul',
  location: 'food_street',
  stage: 'strangers',
  relationship: {
    characterId: CHARACTER,
    affinity: 10,
    stage: 'strangers',
    interactionCount: 0,
    lastInteraction: 0,
    storyFlags: {},
    significantMoments: [],
  },
  mastery: {
    script: { learned: [], total: 24 },
    pronunciation: { accuracy: 0, weakSounds: [] },
    vocabulary: { strong: [], weak: [], total: 45, mastered: 0 },
    grammar: { mastered: [], learning: [], notStarted: [] },
  },
  isFirstEncounter: true,
  selfAssessedLevel: 0,
  calibratedLevel: null,
  locationLevel: 0,
  objectives: [],
  explainIn: 'en',
  isTutorial: true,
  playerName: PLAYER_NAME,
  exitLine: `${PLAYER_NAME}... 나쁘지 않았어. See you around.`,
};

let exercisesDone = 0;
let videoStatus = 'generating';
// Simulate video becoming ready after exercise 2
const VIDEO_READY_AFTER = 2;

function buildCtx() {
  return JSON.stringify({
    ...BASE_CTX,
    videoStatus,
    exitVideoUrl: videoStatus === 'ready' ? '/assets/cinematics/haeun/exit_3.mp4' : null,
    exercisesDone,
  });
}

function buildUserMsg(content) {
  return { role: 'user', content: `[HANGOUT_CONTEXT]${buildCtx()}[/HANGOUT_CONTEXT] ${content}` };
}

/** Parse AI SDK data stream — collect tool calls from 9: lines and tool results from a: lines */
function parseStream(text) {
  const toolCalls = [];
  const toolResults = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('9:')) {
      try {
        toolCalls.push(JSON.parse(line.slice(2)));
      } catch { /* skip */ }
    } else if (line.startsWith('a:')) {
      try {
        toolResults.push(JSON.parse(line.slice(2)));
      } catch { /* skip */ }
    }
  }
  return { toolCalls, toolResults };
}

/**
 * Build assistant message in AI SDK UIMessage format.
 * Tool calls include state:'result' and result so resolveUnresolvedTools doesn't need to fix them.
 */
function buildAssistantMsg(toolCalls, toolResults) {
  // Map toolCallId → result
  const resultMap = {};
  for (const tr of toolResults) {
    resultMap[tr.toolCallId] = tr.result;
  }

  return {
    role: 'assistant',
    content: toolCalls.map(tc => ({
      type: 'tool-call',
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      args: tc.args,
      state: 'result',
      result: resultMap[tc.toolCallId] ?? tc.args,
    })),
  };
}

/**
 * Build tool result message in AI SDK CoreMessage format.
 * This is required between the assistant tool-call message and the next user message.
 */
function buildToolResultMsg(toolCalls, toolResults) {
  const resultMap = {};
  for (const tr of toolResults) {
    resultMap[tr.toolCallId] = tr.result;
  }

  return {
    role: 'tool',
    content: toolCalls.map(tc => ({
      type: 'tool-result',
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      result: resultMap[tc.toolCallId] ?? tc.args,
    })),
  };
}

async function sendTurn(messages) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  return res.text();
}

function printToolCalls(toolCalls, turnLabel) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  TURN: ${turnLabel}`);
  console.log(`  exercisesDone=${exercisesDone}  videoStatus=${videoStatus}`);
  console.log('═'.repeat(60));
  for (const tc of toolCalls) {
    const name = tc.toolName;
    const args = tc.args;
    switch (name) {
      case 'npc_speak':
        console.log(`  💬 ${args.characterId}: "${args.text}"`);
        if (args.translation) console.log(`     ↳ ${args.translation}`);
        if (args.expression) console.log(`     [${args.expression}] affinity: ${args.affinityDelta ?? 0}`);
        break;
      case 'tong_whisper':
        console.log(`  🔮 Tong: "${args.message}"`);
        break;
      case 'show_exercise':
        console.log(`  📝 EXERCISE: ${args.exerciseType} (${args.objectiveId})`);
        if (args.hintItems) console.log(`     hints: [${args.hintItems.join(', ')}]`);
        if (args.context) console.log(`     context: ${args.context}`);
        break;
      case 'offer_choices':
        console.log(`  🔀 CHOICES: ${args.prompt}`);
        for (const c of args.choices) console.log(`     [${c.id}] ${c.text}`);
        break;
      case 'play_cinematic':
        console.log(`  🎬 CINEMATIC: ${args.videoUrl} (auto=${args.autoAdvance})`);
        break;
      case 'set_backdrop':
        console.log(`  🖼️  BACKDROP: ${args.backdropUrl} (${args.transition})`);
        break;
      case 'assess_result':
        console.log(`  📊 ASSESS: ${args.objectiveId} → ${args.score}/100 — ${args.feedback}`);
        break;
      case 'end_scene':
        console.log(`  🏁 END SCENE: ${args.summary}`);
        console.log(`     XP: +${args.xpEarned}  Affinity: ${JSON.stringify(args.affinityChanges)}`);
        break;
      default:
        console.log(`  ❓ ${name}: ${JSON.stringify(args).slice(0, 100)}`);
    }
  }
}

async function main() {
  console.log(`\n🎮 Tutorial Hangout Test — ${CHARACTER} + ${PLAYER_NAME}\n`);

  const messages = [];
  let ended = false;
  // Track last turn's tool calls separately for deciding next response
  let lastTurnToolCalls = [];

  for (let turn = 1; turn <= MAX_TURNS && !ended; turn++) {
    // Build user message
    let userContent;
    if (turn === 1) {
      userContent = 'Start the scene.';
    } else {
      // Decide response based on last turn's tool calls
      const lastToolNames = lastTurnToolCalls.map(c => c.toolName);

      if (lastToolNames.includes('show_exercise')) {
        // Simulate exercise result (alternate correct/incorrect)
        exercisesDone++;
        const correct = exercisesDone % 2 === 1; // odd = correct
        userContent = `Exercise result: ${correct ? 'correct' : 'incorrect'} (exercise-${exercisesDone})`;
        // Simulate video becoming ready
        if (exercisesDone >= VIDEO_READY_AFTER) videoStatus = 'ready';
      } else if (lastToolNames.includes('offer_choices')) {
        const choiceArgs = lastTurnToolCalls.find(c => c.toolName === 'offer_choices')?.args;
        const firstChoice = choiceArgs?.choices?.[0]?.id ?? 'A';
        userContent = `Choice: ${firstChoice}`;
      } else if (lastToolNames.includes('end_scene')) {
        ended = true;
        break;
      } else {
        userContent = 'Continue.';
      }
    }

    const userMsg = buildUserMsg(userContent);
    messages.push(userMsg);

    // Send
    let rawResponse;
    try {
      rawResponse = await sendTurn(messages);
    } catch (err) {
      console.error(`\n❌ Turn ${turn} failed:`, err.message);
      break;
    }

    // Check for error
    if (rawResponse.includes('"An error occurred"') || rawResponse.startsWith('3:')) {
      console.error(`\n❌ Turn ${turn} API error:`, rawResponse.slice(0, 500));
      break;
    }

    const { toolCalls, toolResults } = parseStream(rawResponse);
    if (toolCalls.length === 0) {
      console.log(`\n⚠️  Turn ${turn}: no tool calls in response`);
      console.log('   Raw:', rawResponse.slice(0, 500));
      break;
    }

    printToolCalls(toolCalls, `${turn} (user: "${userContent.slice(0, 50)}")`);

    // Check if scene ended
    if (toolCalls.some(tc => tc.toolName === 'end_scene')) {
      ended = true;
      break;
    }

    // Store for next turn's decision logic
    lastTurnToolCalls = toolCalls;

    // Build assistant + tool result messages for history (AI SDK format)
    const assistantMsg = buildAssistantMsg(toolCalls, toolResults);
    const toolResultMsg = buildToolResultMsg(toolCalls, toolResults);
    messages.push(assistantMsg);
    messages.push(toolResultMsg);
  }

  if (!ended) {
    console.log(`\n⚠️  Scene did not end within ${MAX_TURNS} turns`);
  }
  console.log(`\n✅ Test complete. Total exercises: ${exercisesDone}, Video status: ${videoStatus}\n`);
}

main().catch(console.error);
