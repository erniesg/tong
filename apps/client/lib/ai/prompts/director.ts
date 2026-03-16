import type { LocationPipeline } from '@/lib/types/director';

/**
 * Build the system prompt for the AI Director.
 * Two-stage flow: Plan (concept + characters + curriculum) → Backdrops.
 */
export function buildDirectorPrompt(pipeline: LocationPipeline, feedback?: string): string {
  const stage = pipeline.currentStage;
  const city = pipeline.cityId;

  const existingContext = [
    pipeline.selectedConcept && `APPROVED CONCEPT:\n${JSON.stringify(pipeline.selectedConcept, null, 2)}`,
    pipeline.selectedCharacters.length > 0 && `APPROVED CHARACTERS:\n${JSON.stringify(pipeline.selectedCharacters, null, 2)}`,
    pipeline.selectedCurriculum && `APPROVED CURRICULUM:\n${JSON.stringify(pipeline.selectedCurriculum, null, 2)}`,
    pipeline.selectedBackdrop && `APPROVED BACKDROP:\n${JSON.stringify(pipeline.selectedBackdrop, null, 2)}`,
  ].filter(Boolean).join('\n\n');

  const locationStub = pipeline.locationStub
    ? `\nEXISTING LOCATION STUB:\n${JSON.stringify(pipeline.locationStub, null, 2)}\n`
    : '';

  const feedbackBlock = feedback ? `\nDEVELOPER FEEDBACK: ${feedback}\nAdjust your proposals based on this feedback.\n` : '';

  return `You are the AI Director for Tong, an AI-powered language learning game set in East Asian cities.
You are fleshing out a SPECIFIC existing location — do NOT invent a different location.

## Game Context
- Players are K-entertainment trainees learning Korean/Chinese/Japanese
- Each location is a real-world place where language learning happens naturally
- Locations have NPCs the player can hang out with (visual novel dialogue scenes)
- Hangouts involve natural conversation with exercises woven in (matching, pronunciation, fill-in-the-blank)
- Content must be culturally authentic and pedagogically sound
- The game uses visual novel-style scenes with dialogue, exercises, and choices

## Language Mapping
- Seoul → Korean (ko)
- Shanghai → Chinese Mandarin (zh)
- Tokyo → Japanese (ja)

## Current Pipeline State
Stage: ${stage}
City: ${city}
${locationStub}
${existingContext}
${feedbackBlock}

## Stage-Specific Instructions

${getStageInstructions(stage, city)}

## Output Rules
- Call the appropriate tool(s) for the current stage
- Be culturally specific and authentic — avoid generic "Asian" stereotypes
- Vocabulary and grammar must be appropriate for the location's domain
- Characters should feel like real people with distinct voices`;
}

function getStageInstructions(stage: string, city: string): string {
  const langMap: Record<string, { lang: string; langCode: string }> = {
    seoul: { lang: 'Korean', langCode: 'ko' },
    shanghai: { lang: 'Chinese Mandarin', langCode: 'zh' },
    tokyo: { lang: 'Japanese', langCode: 'ja' },
  };
  const { lang, langCode } = langMap[city] || langMap.seoul;

  switch (stage) {
    case 'plan':
      return `### PLAN STAGE
You are generating a COMPLETE PLAN for this location in a single pass.
The location already exists as a stub — you are fleshing it out with rich content.

You MUST call these tools in order:

1. Call \`propose_plan\` ONCE with a complete location plan that includes:
   - concept: the location's identity (expand on the existing stub's name, domain, and ambient description)
   - characters: 2-3 NPCs that naturally belong in this location
   - curriculum: what the player learns here (vocab, grammar, levels with objectives)

The concept MUST match the existing location stub — same id, same name, same domain.
Expand the ambientDescription, add culturalHook and narrativeHook.

Character guidelines:
- Each NPC needs a distinct voice — different speech patterns, personality, role
- At least one should be a peer/friend archetype, one can be an authority/service worker
- Speech style must include ${lang} slang and natural code-mixing patterns
- byRelationshipStage must show realistic progression from formal to intimate

Curriculum rules:
- Level 0 (Script): reading/recognizing ${lang} characters relevant to this domain
- Level 1 (Pronunciation): correctly saying domain-specific words
- Level 2 (Vocabulary): meaning of 20+ words, organized by category
- Level 3 (Grammar): 3+ sentence patterns useful in this context
- Each objective needs: id, levelNumber, category, title, description, targetItems, targetCount, assessmentThreshold, prerequisites, tags
- Prerequisites must form a valid DAG — no cycles
- Vocabulary should include: domain nouns, relevant verbs, adjectives, courtesy phrases
- Grammar patterns should be practically useful in this location's context
- sceneContext should tie each word to something visible/audible in the scene

2. Call \`director_message\` to explain your design decisions and ask for feedback.`;

    case 'backdrops':
      return `### BACKDROPS STAGE
Generate 3 backdrop image prompts for this location. Use the approved concept for context.

Call \`propose_backdrop\` 3 times, each with:
- prompt: detailed visual description for image generation (Volcengine Seedream)
- timeOfDay: morning|day|afternoon|evening|night|rain
- mood: warm|cool|energetic|melancholy|mysterious|romantic

Prompt guidelines:
- Write in the style of a cinematographer's shot description
- 9:16 portrait orientation (mobile-first)
- Include specific architectural details, lighting, props, atmosphere
- Reference real visual elements of ${city}
- No people in the backdrop (characters are rendered as sprites on top)
- Each option should feel meaningfully different (different time/mood/angle)
- Consider what time of day and mood best fits the location's vibe`;

    default:
      return '';
  }
}
