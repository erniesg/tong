# Shanghai H1 Overview

## What this is

H1 of the Shanghai onboarding hangout. The player enters a 小笼包店 through the wide onboarding panorama when they prioritize learning Chinese, starts on the right edge while Tong introduces the room and the first negotiation-learning hook, completes the anchored 方案 exercise, pans/scrolls left to eavesdrop, enters the webtoon strip automatically, scrolls to the end, and exits after Tong closes the scene. There is no Dingman/Shoucheng tap target in V1; panning is attention, not a camera or seat switch. The same fixture should support both a deterministic rehearsal path and the AI-orchestrated path.

Canonical player-facing flow, dialogue, exercises, and QA acceptance now live in `docs/shanghai/onboarding-canonical-flow.md`. Treat that file as the source of truth before editing Shanghai H1 copy or dispatching an agent.

Canonical media for the hangout is `apps/client/public/assets/locations/shanghai-onboarding.mp4`, copied from `~/Downloads/shanghai.mp4`, with poster fallback `apps/client/public/assets/locations/shanghai-onboarding-poster.jpg`. Runtime keys are `city.shanghai.location.dumpling-shop.panorama.video.default` and `city.shanghai.location.dumpling-shop.panorama.poster.default`; the content contract lives in `apps/client/lib/content/shanghai/onboarding-flow.ts`. Do not use `apps/client/public/assets/locations/shanghai.mp4` for this; that is the city-map loop.

Shanghai must reuse the same onboarding hangout shell as Seoul: `scene-root`, `game-frame`, `GameHUD`, `TongOverlay`, `DialogueBox`, existing exercise overlays, and webtoon takeover inside the phone frame. The panorama is scene media, not a separate page style.

For unattended remote work, use `docs/shanghai/remote-agent-onboarding.md` before assigning or dispatching a slice. This handoff remains the local-worker and implementation overview.

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
2. docs/shanghai/HANDOFF.md
3. docs/shanghai/remote-agent-onboarding.md
4. docs/shanghai/h1-generation-prompts.md (or .zh.md)
5. Seoul reference patterns in the existing content, prompt, and route files

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

1. `/game?fresh=1&priority=zh` routes to `/onboarding/shanghai?entry=chinese-priority&reset=1`
2. The Shanghai route starts on the right edge of `shanghai-onboarding.mp4`
3. Tong uses the standard overlay to establish the shop, observer role, and 方案 learning anchor before panning unlocks
4. The 方案 exercise returns to the same hangout panorama and then unlocks pan/eavesdrop
5. Panning/scrolling left enters the webtoon strip automatically; no character tap or `hangoutSeat` state is used in V1
6. Webtoon panels render correctly on mobile and desktop, then Tong closes the scene and exits back to the Shanghai map
7. Type check and relevant unit tests pass
8. Seoul flow has no regressions

QA shortcut: `/onboarding/shanghai?entry=chinese-priority&focus=webtoon&reset=1` mounts the webtoon strip directly for visual proof only; it is not the player path.
