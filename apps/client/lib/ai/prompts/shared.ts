import type { Character, Relationship, RelationshipStage } from '../../types/relationship';
import { computeTargetLangPercent } from '../../types/relationship';
import type { MasterySnapshot } from '../../types/mastery';
import type { ItemMastery } from '../../types/mastery';
import type { LearningObjective } from '../../types/objectives';
import { getUnlockedObjectives, getCompletedObjectives } from '../../curriculum/prerequisites';
import { getDueItems } from '../../curriculum/srs';
import { HANGUL_DESIGN_PRINCIPLES, type DesignPrinciple } from '../../content/scripts/hangul';
import { PINYIN_DESIGN_PRINCIPLES } from '../../content/scripts/pinyin';
import { KANA_DESIGN_PRINCIPLES } from '../../content/scripts/kana';

const LEVEL_NAMES: Record<number, string> = {
  0: 'SCRIPT',
  1: 'PRONUNCIATION',
  2: 'VOCABULARY',
  3: 'GRAMMAR',
  4: 'SENTENCES',
  5: 'CONVERSATION',
  6: 'MASTERY',
};

export function formatCharacterBlock(
  char: Character,
  rel: Relationship,
  stage: RelationshipStage,
): string {
  const stageConfig = char.speechStyle.byRelationshipStage[stage];
  const charNameKey = Object.keys(char.name).find((k) => k !== 'en') ?? 'en';
  const nativeName = char.name[charNameKey] ?? char.id;

  return `CHARACTER: ${nativeName} (${char.name.en})
- Role: ${char.role} — ${char.context}
- Archetype: ${char.archetype}
- Personality: ${char.personality.traits.join(', ')}
- Motivations: ${char.personality.motivations}
- Quirks: ${char.personality.quirks.join('; ')}
- Likes: ${char.personality.likes.join(', ')}
- Dislikes: ${char.personality.dislikes.join(', ')}

RELATIONSHIP WITH PLAYER:
- Stage: ${rel.stage} (affinity ${rel.affinity}/100, met ${rel.interactionCount} times)
- Tone at this stage: ${stageConfig.tone}
- Register: ${stageConfig.register}
- Example line: "${stageConfig.exampleLine}"
${rel.significantMoments.length > 0 ? `- Key moments:\n${rel.significantMoments.map((m) => `  - ${m.description}`).join('\n')}` : ''}

SPEECH STYLE:
- Catchphrases: ${char.speechStyle.catchphrases.join(', ')}
- Slang: ${char.speechStyle.slang.join(', ')}
${char.speechStyle.dialectNotes ? `- Dialect: ${char.speechStyle.dialectNotes}` : ''}
- Register: ${stageConfig.register}`;
}

export function formatMasteryBlock(mastery: MasterySnapshot): string {
  return `MASTERY:
- Script: ${mastery.script.learned.length}/${mastery.script.total} symbols
- Pronunciation: ${mastery.pronunciation.accuracy}% overall${mastery.pronunciation.weakSounds.length > 0 ? ` (weak: ${mastery.pronunciation.weakSounds.join(', ')})` : ''}
- Vocabulary: ${mastery.vocabulary.mastered}/${mastery.vocabulary.total} words
  Strong: ${mastery.vocabulary.strong.slice(0, 10).join(', ') || '(none yet)'}
  Needs work: ${mastery.vocabulary.weak.slice(0, 10).join(', ') || '(none yet)'}
- Grammar: Mastered [${mastery.grammar.mastered.join(', ') || 'none'}]
  Learning [${mastery.grammar.learning.join(', ') || 'none'}]
  Not started [${mastery.grammar.notStarted.join(', ') || 'none'}]`;
}

export function formatObjectivesBlock(objectives: LearningObjective[]): string {
  if (objectives.length === 0) return 'OBJECTIVES: (none set)';
  return `OBJECTIVES:
${objectives.map((o) => `- ${o.title} [${o.id}] (${o.category}, ${o.targetCount} items, ${Math.round(o.assessmentThreshold * 100)}% threshold)`).join('\n')}`;
}

export function formatPlayerBlock(
  playerLevel: number,
  selfAssessedLevel: number | null,
  calibratedLevel: number | null,
): string {
  const levelName = LEVEL_NAMES[playerLevel] ?? 'UNKNOWN';
  let block = `PLAYER:
- Level: ${playerLevel} (${levelName})`;
  if (selfAssessedLevel !== null) {
    block += `\n- Self-assessed: ${selfAssessedLevel}`;
  }
  if (calibratedLevel !== null) {
    block += `\n- Calibrated (from assessment): ${calibratedLevel}`;
  }
  return block;
}

const EXPLAIN_LANG_NAMES: Record<string, string> = {
  en: 'English',
  ko: 'Korean',
  ja: 'Japanese',
  zh: 'Chinese',
};

export function formatLanguageRatio(
  playerLevel: number,
  stage: RelationshipStage,
  explainIn: string = 'en',
): string {
  const pct = computeTargetLangPercent(playerLevel, stage);
  const explainLangName = EXPLAIN_LANG_NAMES[explainIn] ?? 'English';
  return `LANGUAGE RATIO:
- Use ~${pct}% Korean, rest ${explainLangName}
- Level ${playerLevel} guidelines:
  0-1: single words, basic greetings only
  2-3: simple sentences with known grammar
  4-5: natural sentences, explain grammar in target language
  6: speak almost entirely in target language`;
}

/**
 * Format curriculum state block for AI prompts.
 * Includes unlocked objectives, due review items, and relevant design principles.
 */
export function formatCurriculumBlock(
  allObjectives: LearningObjective[],
  itemMastery: Record<string, ItemMastery>,
): string {
  const unlocked = getUnlockedObjectives(allObjectives, itemMastery);
  const completed = getCompletedObjectives(allObjectives, itemMastery);
  const dueItems = getDueItems(itemMastery).slice(0, 20);

  const unlockedNotComplete = unlocked.filter(
    (o) => !completed.some((c) => c.id === o.id),
  );

  let block = `CURRICULUM STATE:
- Completed objectives: ${completed.map((o) => o.id).join(', ') || '(none)'}
- Available objectives: ${unlockedNotComplete.map((o) => `${o.id} (${o.title})`).join(', ') || '(none — all done or blocked)'}
- Locked objectives: ${allObjectives.filter((o) => !unlocked.some((u) => u.id === o.id)).map((o) => `${o.id} [needs: ${o.prerequisites.join(', ')}]`).join(', ') || '(none)'}`;

  if (dueItems.length > 0) {
    block += `\n- Items due for review (SRS): ${dueItems.join(', ')}`;
  }

  return block;
}

/**
 * Format Hangul design principles for the AI to reference when teaching.
 */
export function formatDesignPrinciplesBlock(
  relevantPrinciples?: DesignPrinciple[],
): string {
  const principles = relevantPrinciples ?? HANGUL_DESIGN_PRINCIPLES;
  if (principles.length === 0) return '';

  // Determine header based on content
  const isHangul = principles === HANGUL_DESIGN_PRINCIPLES || principles.some((p) => p.id.includes('consonant-organ') || p.id.includes('syllable-blocks'));
  const isPinyin = principles.some((p) => p.id.includes('tone') || p.id.includes('radical'));
  const isKana = principles.some((p) => p.id.includes('hiragana') || p.id.includes('katakana') || p.id.includes('dakuten'));

  const header = isPinyin
    ? 'CHINESE SCRIPT PRINCIPLES'
    : isKana
      ? 'JAPANESE KANA PRINCIPLES'
      : isHangul
        ? 'HANGUL DESIGN PRINCIPLES'
        : 'SCRIPT DESIGN PRINCIPLES';

  return `${header} (use these to teach WHY characters work this way):
${principles.map((p) => `- ${p.title}: ${p.teachingHook}
  Examples: ${p.examples.map((e) => `${e.chars} — ${e.explanation}`).join('; ')}`).join('\n')}`;
}

/**
 * Format script system block per language using structured design principles.
 */
export function formatScriptSystemBlock(language: 'ko' | 'zh' | 'ja'): string {
  switch (language) {
    case 'ko':
      return formatDesignPrinciplesBlock();
    case 'zh':
      return formatDesignPrinciplesBlock(PINYIN_DESIGN_PRINCIPLES);
    case 'ja':
      return formatDesignPrinciplesBlock(KANA_DESIGN_PRINCIPLES);
    default:
      return '';
  }
}
