/**
 * Shanghai H1 onboarding — dynamic orchestration prompt.
 *
 * Status: V1 ships the fixture-verbatim path at /onboarding/shanghai. This
 * module is the scaffold for the dynamic follow-on (Issue #196). When routed
 * through this prompt, the LLM is expected to emit hangout tool-calls matching
 * the fixture beat structure while honoring each character's voice rules and
 * yielding to the locked lines the fixture specifies.
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
  /** Which NPC the player is facing. Onboarding is deterministic: 'dingman'. */
  seat: 'dingman' | 'shoucheng';
  masterySnapshot?: MasterySnapshot;
  /** Language Tong explains in. Default 'en'. */
  explainLang?: 'en' | 'zh';
}

const ROLE_FRAMING = `You orchestrate Shanghai H1 — the player's first hangout in a 小笼包店. This is an EAVESDROP scene: only 方阿姨 ever addresses the player. 守成 and 丁漫 are oblivious. Tong (the player's companion) speaks only to the player, never to the NPCs.

Output is a stream of hangout tool-calls in beat order. The fixture supplies the skeleton: every beat marked with lockedLines MUST emit that line verbatim via npc_speak. Beats with only variantExamples may paraphrase within the styleRules. Do not invent beats that are not in the fixture.`;

const WEBTOON_GUIDANCE = `The entire scene is presented as a vertically scrolling webtoon. Call show_webtoon ONCE at the start with the full panel array from the fixture. Subsequent tool calls (tong_whisper, show_exercise, credit_gate, end_scene) are overlays fired as the player scrolls.

Never write new webtoon panels; the art is pregenerated and ships with the fixture.`;

const TURN_GUARDRAILS = `Conversation-state rules:
- If the conversation does NOT already contain show_webtoon, your first response must be show_webtoon only.
- If show_webtoon has already happened, do NOT emit it again.
- After the strip completes, use Tong overlays, exercises, and the credit gate to continue the onboarding flow.
- After a credit gate decision arrives from the user, resolve the aftermath and emit end_scene.`;

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

function webtoonPayloadBlock(fixture: SceneFixture): string {
  const payload = fixture.cliffhanger?.webtoon ?? { panels: [], autoAdvance: false };
  return [
    '=== Webtoon payload (emit via show_webtoon exactly as structured here) ===',
    JSON.stringify(payload, null, 2),
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
    '=== Webtoon ===',
    WEBTOON_GUIDANCE,
    '',
    TURN_GUARDRAILS,
    '',
    webtoonPayloadBlock(fixture),
    '',
    '=== Validator ===',
    VALIDATOR_NOTE,
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
