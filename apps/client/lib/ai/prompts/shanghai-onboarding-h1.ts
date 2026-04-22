/**
 * Shanghai H1 onboarding — dynamic orchestration prompt.
 *
 * Status: V1 shares one canonical H1 fixture across fixture and dynamic
 * runtimes. This prompt is the dynamic orchestrator that must stay aligned
 * with the fixture order rather than inventing a second Shanghai onboarding
 * flow.
 *
 * Source of prose guidelines: docs/shanghai/h1-generation-prompts.md §6.
 * Source of voice rules: apps/client/lib/content/shanghai/characters.ts.
 * Source of beat structure: apps/client/lib/content/shanghai/fixtures/h1-negotiation.ts.
 */

import type { SceneFixture } from '@/lib/hangout/fixture-types';
import { voiceRulesBlock, type ShanghaiCharacterId } from '@/lib/content/shanghai/characters';
import type { MasterySnapshot } from '@/lib/types/mastery';

export interface ShanghaiOnboardingH1Vars {
  fixture: SceneFixture;
  playerName: string;
  playerChineseName?: string;
  /** Which NPC the player is facing for this run. */
  seat: 'dingman' | 'shoucheng';
  masterySnapshot?: MasterySnapshot;
  /** Language Tong explains in. Default 'en'. */
  explainLang?: 'en' | 'zh';
}

const ROLE_FRAMING = `You orchestrate Shanghai H1 — the player's first hangout in a 小笼包店. This is an EAVESDROP scene: only 方阿姨 ever addresses the player. 守成 and 丁漫 are oblivious. Tong (the player's companion) speaks only to the player, never to the NPCs.

Output is a stream of hangout tool-calls in beat order. The fixture supplies the skeleton: every beat marked with lockedLines MUST emit that line verbatim via npc_speak. Beats with only variantExamples may paraphrase within the styleRules. Do not invent beats that are not in the fixture.`;

const TOOL_RULES = `Tool mapping:
- Start the scene with set_backdrop using the selected POV seatDescription as ambientDescription.
- Then emit Tong's opening tong_whisper from fixture.entryNarration before any NPC beat.
- speaker in {dingman, shoucheng, ayi} -> npc_speak
- speaker = ambient -> set_atmosphere
- beat.tongBeat trigger="before" -> tong_whisper before the parent beat
- beat.tongBeat trigger="after" -> tong_whisper after the parent beat
- beat.exerciseHook -> show_exercise after the parent beat's Tong whisper
- Cliffhanger panels -> show_webtoon exactly once, near the end, after all dialogue beats are complete
- After the webtoon, emit the cliffhanger Tong beat, then credit_gate, then the spend/skip aftermath, then end_scene
- Never emit offer_choices for this scene`;

const TURN_GUARDRAILS = `Conversation-state rules:
- Turn 1 (before any Exercise result): emit set_backdrop, Tong's opening tong_whisper, beats b1a -> b1d, Tong's 方案 explanation, then the first show_exercise. Stop there.
- Turn 2 (after one Exercise result, before a second): emit beats b2a -> b2f from the same chosen pair, Tong's 装 / 愿意 explanation, then the second show_exercise. Stop there.
- Turn 3 (after two Exercise results, before any Credit gate decision): emit beats ex1 -> ex8, then show_webtoon, then the cliffhanger Tong beat, then credit_gate. Stop there.
- Turn 4 (after a Credit gate decision arrives): emit only the spend/skip aftermath and end_scene.
- If set_backdrop has already happened, do NOT emit it again.
- If the opening Tong whisper has already happened, do NOT emit it again.
- Do NOT emit show_webtoon until all dialogue beats through ex8 are complete.
- If show_webtoon has already happened, do NOT emit it again.`;

const VALIDATOR_NOTE = `Every npc_speak is post-validated against the character's voice rules. If the validator reports a violation, you will be asked to regenerate. On second regeneration, fall back to the beat's lockedLines[0]. Do not argue with the validator — comply.`;

function masteryBlock(snapshot?: MasterySnapshot): string {
  if (!snapshot) {
    return 'Player mastery: brand new to Mandarin. Tong explains everything. Ratio: ~75% target language with inline gloss, 25% explanation language.';
  }
  const strong = snapshot.vocabulary?.strong ?? [];
  const weak = snapshot.vocabulary?.weak ?? [];
  const grammarMastered = snapshot.grammar?.mastered ?? [];
  return [
    `Player mastery snapshot:`,
    `  vocabulary strong (no re-teach): ${strong.length ? strong.slice(0, 12).join(', ') : '(none)'}`,
    `  vocabulary weak (priority): ${weak.length ? weak.slice(0, 12).join(', ') : '(none)'}`,
    `  grammar mastered: ${grammarMastered.length ? grammarMastered.join(', ') : '(none)'}`,
  ].join('\n');
}

function seatFraming(seat: 'dingman' | 'shoucheng', fixture: SceneFixture): string {
  const variant = fixture.povVariants?.[seat];
  if (!variant) return `Seat: ${seat}. No POV variant in fixture — use neutral framing.`;
  return `Seat: ${seat}.\n${variant.seatDescription}\n${variant.offscreenVoice ?? ''}`.trim();
}

function beatOutline(fixture: SceneFixture): string {
  const lines = fixture.beats.map((b) => {
    const locked = b.lockedLines?.length ? ` LOCKED: ${b.lockedLines.join(' | ')}` : '';
    const variants = b.variantExamples?.length ? ` variants: ${b.variantExamples.join(' | ')}` : '';
    const pair = b.pairGroup ? ` [pair:${b.pairGroup}]` : '';
    return `  - ${b.id} (${b.speaker}): ${b.intent}${locked}${variants}${pair}`;
  });
  return ['Beat outline (emit via npc_speak in this order):', ...lines].join('\n');
}

function voiceRulesFor(ids: ShanghaiCharacterId[]): string {
  return ids.map((id) => voiceRulesBlock(id)).join('\n\n');
}

function fixtureJsonBlock(fixture: SceneFixture): string {
  return [
    '=== Fixture JSON ===',
    JSON.stringify(fixture, null, 2),
  ].join('\n');
}

export function buildShanghaiOnboardingH1Prompt(vars: ShanghaiOnboardingH1Vars): string {
  const { fixture, playerName, playerChineseName, seat, masterySnapshot, explainLang = 'en' } = vars;
  const voiceRules = voiceRulesFor(['shoucheng', 'dingman', 'fangayi']);
  const endStateUpdates = {
    ...(fixture.resolution.stateUpdates ?? {}),
    hangoutSeat: seat,
    onboardingSceneId: 'shanghai:h1',
    onboardingStatus: 'completed',
  };

  return [
    ROLE_FRAMING,
    '',
    `Player: ${playerName}${playerChineseName ? ` (${playerChineseName})` : ''}.`,
    `Tong explains in: ${explainLang === 'zh' ? 'Simplified Chinese' : 'English'}.`,
    '',
    seatFraming(seat, fixture),
    '',
    masteryBlock(masterySnapshot),
    '',
    '=== Voice rules (authoritative — the validator enforces these) ===',
    voiceRules,
    '',
    '=== Beat structure ===',
    beatOutline(fixture),
    '',
    '=== Tool rules ===',
    TOOL_RULES,
    '',
    TURN_GUARDRAILS,
    '',
    fixtureJsonBlock(fixture),
    '',
    '=== Validator ===',
    VALIDATOR_NOTE,
    '',
    '=== Pair selection ===',
    'Default to the primary 装 pair (b2-pair-A) unless the conversation history explicitly commits to the alternate pair. Once chosen, stay in that pair family consistently.',
    '',
    fixture.cliffhanger?.creditGate
      ? `=== Cliffhanger gate ===\nAfter the final webtoon panel, emit credit_gate with cost=${fixture.cliffhanger.creditGate.cost}. If the client returns spend=true, emit the spendPayload; if spend=false, emit the skipPayload's tong fallback.`
      : '',
    '',
    '=== End ===',
    `When the scene resolves, emit end_scene with:\n  masteryUpdates: ${JSON.stringify(fixture.resolution.masteryUpdates)}\n  affinityChanges: ${JSON.stringify(fixture.resolution.affinityChanges)}\n  stateUpdates: ${JSON.stringify(endStateUpdates)}${fixture.resolution.nextHook ? `\n  nextHook: ${fixture.resolution.nextHook}` : ''}`,
  ]
    .filter(Boolean)
    .join('\n');
}
