---
name: exercise
description: Build, debug, or modify exercise components and types. Use when creating new exercise types, fixing exercise rendering, or working on exercise generation.
---

# Exercise System Architecture

## 10 Exercise Types

| Type | Component | Description |
|------|-----------|-------------|
| `multiple_choice` | `MultipleChoice.tsx` | 4 options, 1 correct, with explanation |
| `matching` | `Matching.tsx` | Pair left↔right items |
| `drag_drop` | `DragDrop.tsx` | Drag items to labeled targets |
| `sentence_builder` | `SentenceBuilder.tsx` | Arrange word tiles in order |
| `fill_blank` | `FillBlank.tsx` | Cloze with multiple choice |
| `pronunciation_select` | `PronunciationSelect.tsx` | Audio-first: hear sound, pick character |
| `pattern_recognition` | `PatternRecognition.tsx` | Identify script design principle |
| `stroke_tracing` | `StrokeTracing.tsx` | Trace character with ghost overlay |
| `error_correction` | `ErrorCorrection.tsx` | Fix grammar/lexical errors |
| `free_input` | `FreeInput.tsx` | Open text input |

All components in `apps/client/components/exercises/`.

## Key Files

| File | Role |
|------|------|
| `components/exercises/ExerciseRenderer.tsx` | Switch dispatcher — routes `exercise.type` to correct component |
| `lib/types/hangout.ts` | Type definitions for all 10 exercise data shapes (`ExerciseData` union) |
| `lib/exercises/generators.ts` | Local fallback generation from vocab pools (consonants, vowels, food, grammar) |
| `lib/exercises/validate.ts` | `parseExerciseData(raw)` — validates AI-generated JSON (needs type, id, objectiveId) |
| `lib/exercises/extract-targets.ts` | Extracts learning items from exercise data for mastery tracking |

## Exercise Data Flow

### AI-generated (preferred)
1. AI calls `show_exercise` with `exerciseData` JSON string
2. `parseExerciseData()` validates it → `ExerciseData` object
3. `ExerciseRenderer` renders appropriate component

### Local fallback
1. AI calls `show_exercise` with `exerciseData: null` + hintItems
2. `generateExercise(type, hints)` creates from vocab pools
3. Same render path

## ExerciseData Schemas

```typescript
// All types share base fields:
{ type, id, objectiveId, difficulty: 1-3, prompt, explanation? }

// Type-specific:
matching:             { pairs: [{left, right}] }
multiple_choice:      { options: [{id, text}], correctOptionId }
fill_blank:           { sentence, blankIndex, options, correctOptionId, grammarNote }
sentence_builder:     { wordTiles: string[], correctOrder: string[], distractors: string[] }
error_correction:     { sentence, errorWordIndex, options, correctOptionId }
free_input:           { expectedAnswers: string[], hint }
pronunciation_select: { targetText, audioOptions: [{id, label, romanization}], correctOptionId }
pattern_recognition:  { pairs: [{chars, explanation}], correctPairIndex, principleId }
stroke_tracing:       { targetChar, ghostOverlay: boolean }
drag_drop:            { items: [{id, text}], targets: [{id, label}], correctMapping: {itemId: targetId} }
```

ID convention: `"ai-{type}-{timestamp}"` for AI-generated, `stableId(type, objectiveId, items)` for local.

## Exercise Quality Rules (from prompts)

- **GOLDEN RULE**: The prompt MUST NOT contain the answer or any option verbatim
- All distractors must be REAL characters from the same category
- Valid Korean consonant jamo: ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ
- Valid Korean vowel jamo: ㅏ ㅑ ㅓ ㅕ ㅗ ㅛ ㅜ ㅠ ㅡ ㅣ ㅐ ㅔ
- For multiple_choice about words: ask about MEANING, not visual identification
- For pronunciation_select: do NOT show the character in the prompt

## Common Tasks

- **Add new exercise type**: Define type in hangout.ts → create component → add to ExerciseRenderer switch → add generator in generators.ts → add extractor in extract-targets.ts
- **Fix exercise rendering**: Edit the specific component in components/exercises/
- **Fix AI exercise quality**: Edit EXERCISE QUALITY RULES in both prompts (hangout-orchestrator.ts + tong-learn.ts)
- **All exercises use i18n**: Import `useUILang` + `t()` for localized button text
