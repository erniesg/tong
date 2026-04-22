# Shanghai H1 Overview

## What this is

H1 of the Shanghai onboarding hangout. The player walks into a 小笼包店, overhears 丁漫 and 守成 negotiating, 守成 leaves first after a phone call, and 方阿姨 closes the scene with a short webtoon cliffhanger. The same fixture should support both a deterministic rehearsal path and the AI-orchestrated path.

## Parallel slices that can start immediately

| Slice | Title | Kind | Unblocks |
| --- | --- | --- | --- |
| 1.1 | Fixture types and schema | TypeScript | Fixture chain, H1 content, panel renderer |
| 2.1 | Shanghai location and vocabulary | Content | H1 fixture |
| 2.2 | Shanghai character sheets | Content | H1 fixture, voice validator, dynamic prompt |
| 3.3 | H1 webtoon panel assets | Art | Independent |

The art slice is the cleanest standalone track. It only needs the Shanghai generation prompts and does not depend on the code path.

## Second wave

- After the schema slice lands: fixture runtime and panel renderer
- After character sheets land: voice rule validator
- After schema and character sheets land: H1 fixture content
- Full dependency detail lives in `docs/shanghai/plan.md`

## Per-worker setup

Each worker gets its own worktree and port. Main repo uses 3000; any parallel worker should pick the next free port.

```bash
cd /Users/erniesg/code/erniesg/tong

git worktree add \
  -b feat/shanghai-{slice-id}-{short-slug} \
  /Users/erniesg/code/erniesg/tong-{slice-id}-{short-slug} \
  main

cd /Users/erniesg/code/erniesg/tong-{slice-id}-{short-slug}/apps/client
npm install

ps aux | grep next | grep -v grep
npx next dev -p 3003
```

When a slice is done, open a PR into the Shanghai integration branch or whichever shared branch is currently carrying the feature.

## Fresh-session prompt

```text
I’m picking up a Shanghai H1 slice in the Tong repo.

Read these first:
1. docs/shanghai/plan.md
2. docs/shanghai/h1-generation-prompts.md (or .zh.md)
3. Seoul reference patterns in the existing content, prompt, and route files

Task rules:
- Follow the red, green, files, and acceptance sections exactly
- Keep scope tight
- Do not modify Seoul content unless the slice explicitly calls for it

Done when:
- The acceptance criteria for the chosen slice pass
- Type checking passes in apps/client
- Tests are added where the slice calls for them
- A PR is ready against the shared Shanghai branch
```

## Shared rules

- Branch naming: `feat/shanghai-{slice-id}-{short-slug}`
- CSS convention: plain CSS in `apps/client/app/globals.css`
- Stack: Next.js 14 App Router, TypeScript, functional components with hooks
- State: `apps/client/lib/store/game-store.ts`
- AI streaming: `useChat` from `ai/react`; SSE from `/api/ai/hangout`
- Do not change Seoul content while working on Shanghai
- Ask before destructive git operations

## V1 definition of done

1. `/game?phase=hangout&city=shanghai&scene=h1&mode=fixture` runs end-to-end without error
2. `/game?phase=hangout&city=shanghai&scene=h1` runs the dynamic path with consistent voice behavior
3. Webtoon panels render correctly on mobile and desktop
4. Credit spend unlocks the full 方阿姨 line and Tong explanation; skip shows the fallback
5. `hangoutSeat` persists across localStorage reload
6. The playtest script passes with zero blockers
7. Type check and relevant unit tests pass
8. Seoul flow has no regressions
