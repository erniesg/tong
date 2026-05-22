# Seoul Jin Dynamic Onboarding Proof

Captured on 2026-05-23 against local client `http://localhost:3010`.

Corrected implementation shape:
- Source of truth checked: Haeun dynamic onboarding at `/game?dev_intro=1&npc=haeun&qa_trace=1`.
- Jin uses the same dynamic hangout runtime: `/game?dev_intro=1&npc=jin&name=Mina&lang=en&dev_act=2&qa_trace=1`.
- Final proof route: `/game?dev_intro=1&dev_act=2&npc=jin&name=Mina&lang=en&qa_trace=1&qa_run_id=seoul-jin-dynamic-proof-final3`.
- `/onboarding/seoul` is now only an alias into `/game?dev_intro=1`, not a separate UI shell.
- `/onboarding/seoul` defaults to a random Seoul companion (`haeun` or `jin`) unless `npc=haeun` or `npc=jin` is supplied.
- Korean-priority profile onboarding performs a full navigation into `/game?dev_intro=1` with a random Seoul companion so the dynamic hangout remounts cleanly.

What the stills prove:
- Vertical mobile capture at `390x844`.
- Shared `SceneView`/`GameHUD` stack.
- `Seoul 서울 · Food Street` context.
- 포장마차 backdrop, not cafe shell.
- Jin cinematic reveal, followed by in-character Jin dialogue and Tong hints.
- Hydrated runtime proof: QA hook exposed dynamic state and `/api/ai/hangout` returned `200` for the captured route.

Files:
- `seoul-jin-onboarding-proof.mp4`
- `seoul-jin-onboarding-proof.webm`
- `01-dynamic-cinematic-reveal.jpg`
- `02-dynamic-jin-chat-pojangmacha.jpg`
- `03-dynamic-next-beat.jpg`
- `04-dynamic-player-agency.jpg`
- `05-dynamic-followup.jpg`
