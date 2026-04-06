---
name: lesson
description: Build, debug, or modify the learn/lesson system. Use when working on structured teaching, SRS, curriculum, prerequisites, or the LearnPanel.
---

# Lesson System Architecture

## Key Files

| File | Role |
|------|------|
| `apps/client/app/api/ai/lesson/route.ts` | Streaming lesson endpoint. 5 tools: `teach_concept`, `show_exercise`, `offer_choices`, `give_feedback`, `wrap_up`. Includes fallback scripted session when no API key |
| `apps/client/lib/ai/prompts/tong-learn.ts` | System prompt builder. Enforces prerequisite ordering, SRS mixing (70/30), exercise quality rules, session pacing |
| `apps/client/components/learn/LearnPanel.tsx` | Main lesson UI. Renders teaching cards, exercises, feedback, choices, summaries. Uses `useChat` with `/api/ai/lesson` |
| `apps/client/lib/curriculum/srs.ts` | SuperMemo-2 algorithm: `sm2()`, `getDueItems()`, `getNewItems()`, `qualityFromCorrect()` |
| `apps/client/lib/curriculum/prerequisites.ts` | Prerequisite graph: `isObjectiveComplete()`, `getUnlockedObjectives()`, `getNextObjective()` |
| `apps/client/lib/types/mastery.ts` | Per-item SRS state: easeFactor, interval, nextReview, repetitions, masteryLevel (new → seen → learning → familiar → mastered) |
| `apps/client/lib/types/objectives.ts` | `LearningObjective`, `Location`, `LocationLevel` — curriculum structure |

## Lesson Flow

1. **LearnPanel** gathers context (player level, mastery snapshot, available objectives)
2. Sends to `/api/ai/lesson` with `buildLearnSystemPrompt()` context
3. AI uses tools in sequence: `teach_concept` → `show_exercise` → `give_feedback` → repeat → `wrap_up`
4. LearnPanel renders each tool call as UI entry
5. Exercise results update game store mastery via `RECORD_ITEM_RESULT`
6. SRS computes next review intervals; prerequisites unlock new objectives

## Lesson Pacing Rules (from prompt)

1. Greet + state today's topic (reference curriculum state)
2. Follow prerequisite graph — foundational before advanced
3. Target 1-2 objectives per session
4. Teach structural patterns BEFORE individual characters
5. Mix SRS: many due items → 30% new / 70% review; otherwise 70% new / 30% review
6. After teaching, use `show_exercise` to test
7. After exercise result, use `give_feedback`
8. Session ends at 3-5 exercises based on accuracy
9. NEVER skip straight to exercises — always teach first

## SRS Details

- Algorithm: SuperMemo-2 (SM-2)
- `sm2(quality, easeFactor, interval, repetitions)` → next interval + ease
- `getDueItems(mastery, now)` → items needing review
- `getNewItems(mastery, allTargets)` → unseen items
- Mastery levels: new (0 correct) → seen (1) → learning (2-3) → familiar (4-7) → mastered (8+)

## Quick Test

Start a learn session: go to city map → tap a location pin → tap "Learn" button.

## Common Tasks

- **Change teaching behavior**: Edit `tong-learn.ts` prompt
- **Add curriculum content**: Add objectives to location levels in `locations.ts` or `pojangmacha.ts`
- **Modify SRS parameters**: Edit `srs.ts` (ease factor, intervals)
- **Change session UI**: Edit `LearnPanel.tsx`
- **Add new tool**: Add zod schema in lesson route.ts + handler in LearnPanel
