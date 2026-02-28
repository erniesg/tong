import type { Character, Relationship, RelationshipStage } from '../../types/relationship';
import { computeTargetLangPercent } from '../../types/relationship';
import type { MasterySnapshot } from '../../types/mastery';
import type { LearningObjective } from '../../types/objectives';

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

export function formatLanguageRatio(
  playerLevel: number,
  stage: RelationshipStage,
): string {
  const pct = computeTargetLangPercent(playerLevel, stage);
  return `LANGUAGE RATIO:
- Use ~${pct}% Korean, rest English
- Level ${playerLevel} guidelines:
  0-1: single words, basic greetings only
  2-3: simple sentences with known grammar
  4-5: natural sentences, explain grammar in target language
  6: speak almost entirely in target language`;
}
