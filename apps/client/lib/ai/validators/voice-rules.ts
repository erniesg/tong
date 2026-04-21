import { getCharacter, type ShanghaiCharacterId } from '@/lib/content/shanghai/characters';
import type { Beat } from '@/lib/hangout/fixture-types';

export type ValidationResult =
  | { ok: true }
  | { ok: false; violations: string[] };

type ValidationContext = {
  previousOwnLines?: string[];
};

const SHANGHAI_CHARACTER_IDS = new Set<ShanghaiCharacterId>(['shoucheng', 'dingman', 'fangayi']);

const DINGMAN_MINIMAL_BEAT_LIMITS: Record<string, number> = {
  b1b: 3,
  ex2: 4,
};

function isShanghaiCharacterId(characterId: string): characterId is ShanghaiCharacterId {
  return SHANGHAI_CHARACTER_IDS.has(characterId as ShanghaiCharacterId);
}

function compactLength(text: string): number {
  return text.replace(/[\s\p{P}\p{S}]/gu, '').length;
}

export function validateLine(
  characterId: string,
  line: string,
  beatContext?: Pick<Beat, 'id'>,
  context: ValidationContext = {},
): ValidationResult {
  if (!isShanghaiCharacterId(characterId)) {
    return { ok: true };
  }

  const normalized = line.trim();
  const violations: string[] = [];
  const character = getCharacter(characterId);

  if (normalized.length === 0) {
    violations.push('empty_line');
  }

  for (const token of character.voiceRules.forbiddenTokens) {
    if (normalized.includes(token)) {
      violations.push(`forbidden_token:${token}`);
    }
  }

  switch (characterId) {
    case 'shoucheng': {
      if (context.previousOwnLines?.some((previous) => previous.trim() === normalized)) {
        violations.push('own_echo');
      }
      break;
    }
    case 'dingman': {
      const maxCompactLength = beatContext?.id ? DINGMAN_MINIMAL_BEAT_LIMITS[beatContext.id] : undefined;
      if (maxCompactLength && compactLength(normalized) > maxCompactLength) {
        violations.push(`overlength:${beatContext?.id}`);
      }

      if (/演员|导师|丑闻|绯闻|以前出名/.test(normalized)) {
        violations.push('forbidden_backstory_reference');
      }
      break;
    }
    case 'fangayi': {
      if (/(?:守成|瞿守成)/.test(normalized) && !normalized.includes('小瞿')) {
        violations.push('missing_diminutive:shoucheng');
      }
      if (/(?:丁漫)/.test(normalized) && !normalized.includes('小丁')) {
        violations.push('missing_diminutive:dingman');
      }
      break;
    }
    default:
      break;
  }

  return violations.length > 0
    ? { ok: false, violations }
    : { ok: true };
}
