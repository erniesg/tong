# Shanghai H1 — Parallel Handoff

**Repo:** `erniesg/tong`
**Feature branch:** `feat/shanghai-onboarding`
**Issues filter:** https://github.com/erniesg/tong/issues?q=is%3Aopen+label%3Ashanghai
**Feature docs:** `docs/shanghai/plan.md`, `docs/shanghai/h1-generation-prompts.md` (+ `.zh.md`), `docs/shanghai/webtoon-layout-system.md`

## What this is

H1 of a Shanghai onboarding hangout. Player walks into a 小笼包店, overhears 丁漫 + 守成 negotiating, 守成 leaves first after a phone call, 方阿姨 reveals 瞿家的小儿子 backstory in a 3-panel webtoon cliffhanger. Runs as a prebaked fixture for dev/QA and AI-orchestrated in prod — same fixture scaffolds both.

Full architecture in `plan.md`. Don't skip it.

---

## Can start RIGHT NOW (no code deps on other cards)

| Issue | Title | Kind | Unblocks |
|---|---|---|---|
| [#187](https://github.com/erniesg/tong/issues/187) | [1.1] Fixture types + schema | TypeScript | Epic 1 chain + H1 fixture + WebtoonPanel |
| [#190](https://github.com/erniesg/tong/issues/190) | [2.1] Shanghai location + vocabulary | Content | H1 fixture |
| [#191](https://github.com/erniesg/tong/issues/191) | [2.2] Shanghai character sheets | Content | H1 fixture + voice validator + dynamic prompt |
| [#195](https://github.com/erniesg/tong/issues/195) | [3.3] H1 webtoon panel assets | **Art work** (image gen) | None — fully independent |

Art (#195) is the most obviously parallelizable — it only needs `docs/shanghai/h1-generation-prompts.zh.md` fed into 即梦 / midjourney. No code.

## Second wave (unblocks after first wave merges)

- **After #187 merges:** [#188](https://github.com/erniesg/tong/issues/188) fixture runtime + [#193](https://github.com/erniesg/tong/issues/193) WebtoonPanel component
- **After #191 merges:** [#197](https://github.com/erniesg/tong/issues/197) voice rule validator
- **After #187 + #191 merge:** [#192](https://github.com/erniesg/tong/issues/192) H1 fixture content
- Full dep graph in `plan.md` → "Dependency graph"

Webtoon note:

- Layout testing does not need final art. Use the backstage webtoon lab with placeholders first.
- Real fixture-art testing begins as soon as files exist at `apps/client/public/assets/webtoon/shanghai/h1/p{1,2,3}.png`.
- Keep WebtoonPanel metadata-driven so future tool-driven panel layout can extend it instead of replacing it.

---

## Per-worker setup

Each parallel worker gets its own worktree + port. Main repo uses 3000; `tong-shanghai` worktree uses 3002. Pick the next free port (3003, 3004, ...) for each parallel card.

```bash
# Create a worktree for your card (run from the main repo)
cd /Users/erniesg/code/erniesg/tong

git worktree add \
  -b feat/shanghai-{issue-id}-{short-slug} \
  /Users/erniesg/code/erniesg/tong-{issue-id}-{short-slug} \
  feat/shanghai-onboarding

cd /Users/erniesg/code/erniesg/tong-{issue-id}-{short-slug}/apps/client
npm install

# Check for running dev servers before picking a port
ps aux | grep next | grep -v grep
npx next dev -p 3003   # or next free port
```

When done: PR your sub-branch into `feat/shanghai-onboarding`. When `feat/shanghai-onboarding` reaches V1 acceptance, PR into `main`.

---

## Paste-ready prompt for a fresh Claude Code / dev session

```
I'm picking up issue #{N} from the Shanghai H1 onboarding feature in erniesg/tong.

Read these first (in this order):
1. docs/shanghai/plan.md — full architecture + your issue's card
2. docs/shanghai/h1-generation-prompts.md (or .zh.md) — dialogue + art prompts
3. Seoul reference patterns:
   - apps/client/lib/content/pojangmacha.ts
   - apps/client/lib/content/characters.ts
   - apps/client/lib/ai/prompts/hangout-orchestrator.ts
   - apps/client/app/api/ai/hangout/route.ts

Your task:
- Run `gh issue view {N}` and follow its Red/Green/Acceptance criteria exactly
- Do not scope-creep — files outside the issue's "Files" list stay untouched
- Do not modify Seoul content (Ha-eun, Jin, pojangmacha)

Working directory:
/Users/erniesg/code/erniesg/tong-{worktree-slug}
on branch feat/shanghai-{issue-id}-{short-slug}

Done when:
- All Acceptance checkboxes on issue #{N} pass
- `npx tsc --noEmit` passes in apps/client
- Tests added where the AC calls for them
- PR opened against feat/shanghai-onboarding

Don't:
- Commit directly to feat/shanghai-onboarding
- Use port 3000 or 3002 for dev server — pick 3003+
- Force-push, reset --hard, or touch shared branches without asking
```

---

## Shared rules (apply to every card)

- **Branch naming:** `feat/shanghai-{issue-id}-{short-slug}` off `feat/shanghai-onboarding`
- **CSS convention:** plain CSS in `apps/client/app/globals.css`, not Tailwind utilities in components
- **Language:** Next.js 14 App Router, TypeScript, functional components with hooks
- **State:** game store at `apps/client/lib/store/game-store.ts` (singleton with localStorage)
- **AI streaming:** `useChat` from `ai/react`; SSE events from `/api/ai/hangout`
- **Tool call convention:** every external integration is a tool, per project memory
- **Don't touch:** Seoul content, main Seoul flow, Seoul characters
- **Before destructive ops:** ask before force-push / reset --hard / branch deletion

---

## V1 definition of done (whole feature)

1. `/game?phase=hangout&city=shanghai&scene=h1&mode=fixture` runs H1 end-to-end without error
2. `/game?phase=hangout&city=shanghai&scene=h1` (dynamic) runs H1 with zero voice rule violations across 10 seeds
3. Webtoon panels render correctly on mobile (≤375px) and desktop (≥1024px)
4. Credit spend unlocks full 方阿姨 line + tong explanation; credit skip shows tong fallback
5. `hangoutSeat` persists across localStorage reload
6. Playtest script ([#205](https://github.com/erniesg/tong/issues/205)) passes with zero blockers
7. Type check + relevant unit tests pass
8. Seoul flow has no regressions

---

## Art work lane (parallel, no code required)

For anyone running the image gen work on [#195](https://github.com/erniesg/tong/issues/195):

1. Read `docs/shanghai/h1-generation-prompts.zh.md` sections 1–5 start to finish
2. Generate character reference sheets first (守成, 丁漫, 方阿姨) using the locked tokens in section 2
3. Generate the backdrop (section 4) using the reference sheets as input
4. Generate panels 1 → 2 → 3 in order, using previous panel as style reference
5. Save at 2× resolution (1600×2400 for 2:3 etc.) to `apps/client/public/assets/webtoon/shanghai/h1/p{1,2,3}.png`
6. Do NOT bake speech bubbles into panel 3 — leave the empty lower 40% for compositor overlay
7. Spot-check the "iteration notes" section (section 8) for common failure modes

The image assets merge into the feature branch without needing any of the code cards to land first.
