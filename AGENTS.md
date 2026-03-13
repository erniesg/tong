# Tong Hackathon Agent Context

## Mission
Build a mobile-first language learning demo with:
- YouTube subtitle augmentation (hangul/hanja/kanji + romanization + English translation)
- Per-word dictionary popover with cross-CJK mappings
- A personalized narrative game world ("Tong" assistant in-character)

## Demo narrative (MVP)
1. Show Korean variety clip with caption overlays.
2. Hover/tap any token to open dictionary card.
3. Show "last 3 days" frequency-derived vocab feed from transcripts/lyrics.
4. Start or resume a profile-driven game session.
5. Tong introduces a city/world and first scene.
6. Run first food-location hangout scene.
7. Show advanced CN texting mission and reward unlock.

## Architecture split
- `apps/client`: Next.js app shell + overlay UI + game UI; wrapped by Capacitor for iOS/Android.
- `apps/server`: server-side APIs, transcript/lyrics ingestion, ranking, personalization.
- `packages/contracts`: request/response contracts and shared domain types.
- `docs/`: build sequencing, worktree map, and decisions.

## Core game model (must stay consistent)
- Cities (swipe map): Seoul, Tokyo, Shanghai.
- Shared location set per city (same 5): Food Street, Cafe, Convenience Store, Subway Hub, Practice Studio.
- Per-location modes: `hangout` and `learn`.
- Every session must be objective-specific and stateful (no generic free chat).
- Progress currencies: XP (mastery progress), SP (unlock spend), RP (relationship progress).
- Gate loop:
1. Learn mode raises mastery readiness.
2. Hangouts validate mastery in-context and raise RP.
3. After enough validated hangouts, open mission assessment.
4. Passing mission unlocks next mastery tier and location options.
- Special advanced flow:
1. Shanghai advanced texting mission (WeChat-like UI).
2. Completion triggers video call reward.
3. Reward also grants collectible "polaroid memory" card.

## UX constraints (must stay consistent)
- Hangout mode:
1. First-person immersion.
2. On-screen content is dialogue + Tong hints/tips only.
3. No admin/debug/meta panels visible during active scene.
- Learn mode:
1. Chatbox styled by current country social app aesthetic.
2. Must support "Start new session" and "View previous sessions".
3. Each session is tied to explicit vocabulary/grammar/sentence objectives.

## Parallel workstream ownership
- `codex/client-shell`: Next.js app shell, mobile-first layout, auth/session bootstrap.
- `codex/client-overlay`: subtitle augmentation UI and dictionary hover/tap interactions.
- `codex/server-api`: API routes, profile/session persistence, game endpoints.
- `codex/server-ingestion`: transcript/lyrics ingest + vocabulary frequency pipeline.
- `codex/game-engine`: branching scene model + Tong in-character response orchestration.
- `codex/infra-deploy`: Cloudflare/Vercel config, CI, environments, release scripts.
- `codex/mock-ui`: clickable high-fidelity mock/demo screens and scripted happy paths.
- `codex/creative-assets`: image/video generation, preset asset pipeline, and content packs.

## Collaboration contracts (do not break without a contract PR)
1. Enriched captions endpoint: `GET /api/v1/captions/enriched?videoId=...&lang=ko`
2. Dictionary entry endpoint: `GET /api/v1/dictionary/entry?term=...&lang=ko`
3. Vocab feed endpoint: `GET /api/v1/vocab/frequency?windowDays=3`
4. Game bootstrap endpoint: `POST /api/v1/game/start-or-resume`
5. Profile endpoint: `PUT /api/v1/profile/proficiency`

## Rules for agent PRs
- Keep all schema changes in `packages/contracts` first.
- Add fixtures/mocks for any new endpoint before wiring UI.
- Prefer additive migrations; no destructive data changes during hackathon.
- Include a short "How to test" section in each PR description.

## Functional QA routing
- When the user asks to step through GitHub issues, fix the issue queue, or decide what can run in parallel, start with `.agents/skills/work-github-issues/SKILL.md`.
- That front-door skill must generate the queue plan first, then route each issue to `validate-issue`, `trace-ui-state`, `validate-issue --verify-fix`, and `publish-issue-update` as needed.
- Use the existing worktree model in `docs/worktree-ownership-map.md` and `docs/hackathon-workstreams.md`; parallelize by worktree lane, not by raw issue count.
- When the user explicitly wants Codex cloud or GitHub PR execution, also use `docs/codex-cloud-issue-runbook.md` and `python .agents/skills/_functional-qa/scripts/codex_cloud_queue.py plan` to generate the current batch order, direct task prompts, and PR notes.
- Prefer the direct Codex environment task flow for implementation work: launch a task on the `tong` environment, get a diff, then create a PR from the task result.
- Do not assume shell-level `git push` or `gh` is available inside Codex cloud tasks.
- Use GitHub comment triggers primarily for `@codex review` or explicitly manual experiments, not as the default implementation path.
- When the user asks to reproduce bugs, verify fixes, validate current behavior, or gather screenshots and traces for a specific issue, start with the functional QA workflow in `.agents/skills/validate-issue/SKILL.md`.
- If validation is ambiguous, timing-sensitive, or points to a state race, continue with `.agents/skills/trace-ui-state/SKILL.md`.
- Publish structured GitHub updates with `.agents/skills/publish-issue-update/SKILL.md` after the run is finalized or when the runtime policy allows auto-commenting.
- For `/game` issues, use the generated `browser-playbook.md` in the run directory and open `/game` with `qa_run_id` and `qa_trace=1` so browser-capable agents can use `window.__TONG_QA__` for state and log exports.
- Treat the functional QA artifact bundle under `artifacts/qa-runs/` as the source of truth for reruns and fix verification.
