# Seoul evals: to be confirmed

Open questions and parked ideas for [`seoul-evals.md`](seoul-evals.md). Add the date and who decided when one closes, then move the decision into the design doc or canon.

## Open

| # | Question | Current proposal | Blocks |
|---|---|---|---|
| T3 | **What eval 11 becomes** now that center is the player's choice. | Keep the CEO debate (argue a position) but about something else, or make it about who you back for center and why. | Eval 11 |
| T4 | **Eval 3 field quest.** | Must test favours on the phone. "Locked out" doesn't hold up: with no phone you don't know anyone's number, and nobody gives a code by ear. Rework or replace. Fan-found-the-dorm (crazed fan, or another agency's idols in the same building) may still be a month 3 beat. | Eval 3 |
| T5 | **Phone battery as a resource.** | Phone drains with texting, maps, camera; charge at the dorm, cafés, the 편의점. Separate from 기력. | Later |
| T6 | **Eval 7 "shout in silence".** | On hold. Feels odd, and standard ASR spells 감사함니다 as 감사합니다 so it can't hear the difference. Replace or rework after the ASR spike. | Eval 7 |
| T7 | **Speech recognition vendor.** | Spike Meta Muse Voice Transcribe vs OpenAI on eval 1–3 lines (`scripts/asr-spike/`). Muse has no confidence scores or word timestamps per its docs, so use it for slot checks only. | Speaking rounds |
| T8 | **Songs beyond 1–3.** | Lyrics written in-house with AI, inspired by real songs, at the eval's level. Music generation and singing voice still to pick. | Evals 4–12 |
| T9 | **Group timeline.** | Survivors of eval 6 become the unit; eval 9 adds name, positions, fandom; eval 12 sets lineup size (7/5/4 from group score). | Evals 6, 9 |
| T10 | **Sua's line.** | Owner agrees she can be discovered before Act 3 with a richer backstory; how, when, where she works and what she knows are undecided. Ideas parked: a night job near the dorm, studying for the 검정고시. | Months 3–9 |
| T11 | **Evals 4–12 round design.** | Review each one after evals 1–3 have been played. | — |
| T12 | **Can the player opt out of a late night that a character asks for** without a relationship cost? | Yes, but the character remembers which you chose. | Day loop |
| T18 | **Can other people see Tong?** | No: Tong floats beside you and only you see and hear it; others see you glance at nothing. H1's "또 그거 써요?" and H2's "폰이 춤추는 거예요?" (written for Tong on a phone) become Haeun noticing you mutter to yourself. | H1, H2, Day 1 |
| T19 | **Sua's snacks on eval day.** | Owner, 2026-11-01: the first snack turns up on eval day (not Day 1). Not yet in any doc or canon: who leaves it, where, and whether anyone knows it's her stays under T10. | Eval 1 day |
| T20 | **Tong's backstory** ("Long story. Another time." on Day 1). | Keep the line as a seed; write nothing about the answer until the owner decides it. | Later |
| T21 | **Day 1 rival.** | 도희 Do-hee says "쟤가 새로 온 애야?": the ex-survival favourite, so the Creator's airport photo touches her sore spot. Minji keeps H1's "Sua's spot" whisper. | Day 1 on-time arrival |

## Closed

| Date | Decision |
|---|---|
| 2026-11-01 | 12 evals over 12 months. A month is a chapter; it ends when the player finishes the eval. |
| 2026-11-01 | One energy meter (기력). Sleep quality sets next-day condition. |
| 2026-11-01 | Tapping Tong stops time. |
| 2026-11-01 | The eval unlocks at a point in the month; the player confirms (point of no return) and it's the next morning. No multi-day window. Played once; unlimited ungraded rehearsal before. |
| 2026-11-01 | Curriculum aligned to TOPIK (table in the design doc). |
| 2026-11-01 | Sua can be discovered before Act 3 with a richer backstory (details in T10). |
| 2026-11-01 | Center: the player can take it if they want it, otherwise it's Haeun's. Small story differences where they make sense. |
| 2026-11-01 | Songs 1–3 written in-house (`seoul-songs.md`). |
| 2026-11-01 | (was T13) Not co-ed. The female player's route is built first. A male player later joins a boys' line with its own cohort. |
| 2026-11-01 | (was T14) Girls and boys live in separate buildings, spread out in the neighbourhood. Yeonnam Apartments is the girls' dorm: rooms of 2–4 on bunk beds, shared kitchen and bathroom, dorm manager, curfew and night check. Canon `world.ts` updated. |
| 2026-11-01 | (was T1) The girls' cohort: 하은 Haeun (18), 도희 Do-hee (18, ex-survival, Haeun's rival), 다온 Da-on (15, youngest), 보람 Bo-ram (22, oldest), 윤서 Yun-seo (19, rich kid), 민지 Minji, 예린 Yerin, and one foreign trainee. Canon in `canon/cohort.ts`. |
| 2026-11-01 | (was T15) The other foreign trainee is picked per save from nationalities that are not the player's (`FOREIGN_TRAINEES`). The others live on the dorm's floor above, in other Onsae units. |
| 2026-11-01 | (was T2) The eval 6 cut is Bo-ram: the industry's fixed cost, expected, and nobody can prevent it. She stays on as assistant choreographer and moves out of the dorm. Losses like this should feel natural to the story. The Athlete's fate becomes "the unit debuts whole" (no one lost after eval 6). |
| 2026-11-01 | (was T17) Rooming. Arrival: Manager Choi offers the free bed in Haeun's room (Sua's); Haeun gives a perfectly polite excuse and you room with Da-on and Bo-ram. Sua's bed stays empty. After Bo-ram's cut the agency merges rooms, so Sua's bed has to be filled: you can ask Haeun for it, and she agrees only on trust. Low trust: Da-on gets it. Rooming unlocks late-night talks (cost sleep), night-time Jeju, noticing small things; losing the room after a betrayal is a consequence. Built: arrival scene `haeun.h0.dorm`. |
| 2026-11-01 | Day 1 (`seoul-day1.md`): language road is the all-stop to 홍대입구 (express is the trap); lockers and the card are part of orientation; formation drill moves to day 2; no kitchen scene; no new exercise types (block crush, sentence builder); ambient gossip that Sua left; no on-screen countdown ("첫 월말평가는 이번 달 말"); hidden counter is `toll`. |
| 2026-11-01 | Origins are picked at the start, in the creator (overrides the PRD's "selection UI out of scope"). |
| 2026-11-01 | Tong is the floating mascot (built 3D Tong), not a phone app. Whether others see it: T18. |
