# Seoul main line: the 12 evaluations

The Seoul route advances through 12 monthly evaluations (March → February), each mapped to a TOPIK level. Source design: "Tong Seoul: The 12 Evaluations" (Chen Enjiao, 2026-11-01). This doc is the working version: the framework and evals 1–3 are specified for build; evals 4–12 stay draft and will be tuned as the first three play. Undecided items live in [`seoul-evals-tbc.md`](seoul-evals-tbc.md). Songs live in [`seoul-songs.md`](seoul-songs.md).

Canon for characters and places is in `apps/client/lib/content/canon/`. Relationship routes are in [`relationship-plan.md`](relationship-plan.md).

## Time

### A month is a chapter

- It stays March until you start eval 1. No date, no day counter on screen.
- Each month has a spine of fixed beats in order (opening beat → free play → mid-month beat → free play → eval). Mid-month beats fire on conditions, not dates (cherry-blossom night fires after two hangouts with anyone).
- Arcs across months open by month ("from June") and close by gate ("before eval 10").
- Scarcity comes from choices that exclude each other (two invitations for the same night), not from a timer.

### Eval week and the one graded attempt

1. When the month's required beats are done, the schedule board shows **평가 주간 시작** (start eval week). Trainers keep mentioning it; the game waits.
2. Starting eval week is the point of no return: "Ready? Some things this month will pass." Seasonal content you skipped is gone.
3. Eval week is three in-game days. Eve-of-eval beats live here (H2 "three days before the placement eval", the banana milk, the night before).
4. Eval day runs the rounds in order. **Each round's result is saved the moment it ends.** There is no save or reload inside eval day.
5. Quitting mid-round resumes that round from its start with a fresh seeded item set at the same difficulty, so quitting gains nothing.
6. Practice is unlimited and ungraded: **리허설** (rehearsal) in the practice studio replays any round you've seen, with new items. Rehearsal moves mastery, never grade or rank.

### The day

| Part | What happens |
|---|---|
| Morning | Wake in the dorm. Morning board: today's schedule, Tong's three suggestions (#385), your condition face. |
| Day | Mandatory practice is the daily anchor. Skipping is possible; trainers notice. The open city. |
| Evening | Free time: hangouts, errands, exploring. |
| Night | Curfew is 23:00 with Manager Choi's night check. Anything after is a sneak-out. The special places and people live here. |
| Sleep | Go to bed whenever you like. The day ends; the diary runs (#385); the next day starts. |

- **Tapping Tong stops time.** Practice, Learn, Review, collections and the phone's reading screens never use clock time or energy.
- Places and people keep hours (#372). "Rest until evening" on a bench or in the dorm skips time.
- Days pass but aren't counted, so sleeping forty times in "March" never looks wrong.

### Energy (기력)

One meter.

| Drains | Restores |
|---|---|
| Dance practice, rounds of rehearsal, running around the city, nights out | Sleep (most), meals, a short rest |

- **Sleep quality** sets tomorrow's condition, shown as a face on the morning board: 상쾌 / 보통 / 피곤 / 엉망. Bed before midnight: full. Bed around 02:00: partial. All-nighter: nothing, and you start tired.
- **Condition affects:** eval timing windows (tired = tighter Perfect window), Tong hint cost, how people react ("너 어제 몇 시에 잤어?").
- **Learning is never energy-gated.** Tong practice, signs, texting and reading cost nothing. Only physical and social outings spend 기력.
- Late nights are rare and authored: 1–2 per month plus the night before an eval. Most nights you just go to bed.
- No weight or diet stat. Diet rules stay story texture.

## Eval day

| Slot | What happens | Tests |
|---|---|---|
| Morning: Vocal | The month's song, through listening or reading aloud | Listening, reading, pronunciation |
| Morning: Dance | The formation grid (follow the call, spell the line, formation change) | Listening under rhythm, reading |
| Morning: Judges | Interview, debate or written task | Speaking, writing |
| Afternoon: Field quest | A real task in the city that feels like life | That level's TOPIK can-do |
| Night: Results | Ranks go up on the board; story beats fire | — |

**Evals add no new mechanics.** Every round remixes a micro-game the player has already met in daily play that month. The table under each eval names where each one is first seen.

### Skills, objectives, tiers

- Every item is tagged with a skill (listening, reading, writing, speaking) and a learning objective.
- **Tiers: same content, different support.**

| Tier | Support | Listening version | Reading version |
|---|---|---|---|
| 1 | Recognition, with help | Hear it with Hangul on screen; pick the meaning | Hear a model, then read it back |
| 2 | Assisted production | Hear it; build it from blocks (block crush) | Read it with no model; speech rec checks it |
| 3 | Free production | Hear it only; type it (dictation) | Sight-read a new line at tempo |

- The game suggests a tier per skill from mastery. Opting up ×1.25, down ×0.8.
- Speaking checks use speech recognition for **intelligibility and slots** (the right item, counter, number, day). Recognition errors are never punished: a low-confidence read becomes a diegetic "뭐라고?" and a retry. Phoneme-level pronunciation scoring is out of scope until the ASR spike says otherwise (`scripts/asr-spike/`).

### Scoring

- Item: accuracy (right/wrong, or a rubric for free production) × timing in rhythm sections (Perfect 1.0, Good 0.8, Miss 0).
- A Tong hint caps that item at half marks. Evals 9–12 allow no Tong hints; tier support stays.
- Free speaking and writing rubric: task completed 40%, accuracy 30%, range 15%, fluency 15%.
- Item mix: 80% this month's objectives, 20% review.
- Eval grade = Vocal 25% + Dance 25% + Judges 25% + Field quest 25%.
- Bands: S 95+, A 85+, B 70+, C 55+, D 40+, F below 40.

**Two numbers.** Performance (0–100 within your tier) drives grade and rank, so beginners can do well. Mastery (a TOPIK-style level per skill) only rises when you succeed at your tier or above, and decides which options you get at story crossroads.

**Failing is never a wall.** D or F means probation scenes (Coach Park, Manager Choi) and next month's daily scenes seeded with the weak objectives. The player is never cut.

**Word counts** below are the cumulative range the month's content draws from, not what a player must know. The game says "TOPIK-style", never certification.

## Curriculum (aligned to TOPIK)

| Month | Eval | TOPIK | Can-do | Key grammar |
|---|---|---|---|---|
| Prologue (March, before eval 1) | — | — | Read Hangul, names, greetings, native counting | Hangul blocks, 이에요/예요 |
| 1 March | Entry eval | 1 | Introduce yourself, family, hobbies, weather; order and buy | -이에요/예요, -아요/어요, 하고, native vs Sino numbers, 개/명/줄/인분 |
| 2 April | Schedules | 1 | Daily routine, time, days, plans | Time (세 시 삼십 분), days, 에 vs 에서, -(으)ㄹ 거예요, -고 싶어요 |
| 3 May | Phone calls and favours | 2 | Make and take calls, ask and offer favours, ask to repeat | -아/어 주세요, -아/어 주실 수 있어요?, -아/어도 돼요?, -(으)ㄹ게요, -(으)니까, 연음 |
| 4 June | Getting around | 2 | Transport, facilities, directions | -(으)로, 갈아타다, -(으)면, -아/어야 해요, particles |
| 5 July | Registers, Golden Bell | 2 | Formal vs informal by situation | -(스)ㅂ니다, 해요, 반말, -(으)시-, honorific verbs and nouns |
| 6 August | Mid-year cut | 3 | Invite, refuse politely, apologise, conflict | -(으)ㄹ래요?, -(으)ㄹ까요?, -는데, -아/어서 미안해요, -고 싶어 하다 |
| 7 September | Fan letters | 3 | Paragraph texts on familiar topics; natural speech | -(으)ㄴ 적이 있다, -게 되다, -는 편이다, -다고 하다 |
| 8 October | Group unit | 3 | Spoken vs written; register by listener; explain meaning | -(ㄴ/는)다, -기 위해, -(으)며, -다는 뜻이에요 |
| 9 November | Running the room | 4 | Follow and relay instructions; report | Reported speech, -도록 하다 |
| 10 December | First stage | 4 | Easy news, abstract topics, formal notices | -에 따르면, -것으로 알려졌다, -게 되었습니다, -잖아/-네/-거든 |
| 11 January | Center battle | 4 | Argue a position, rebut | -기 때문에, -는 반면에, -다고 생각하다, -(으)ㄹ 수밖에 없다 |
| 12 February | Debut showcase | 4→5 | Everything, under pressure | — |

## Eval 1: Entry eval (March · TOPIK 1)

**Can-do:** introduce yourself, family, hobbies, weather; order and buy. ~600 words.

**Month spine:** H0 arrival → H1 paired with Haeun → J0 pojangmacha (any night) → H2 drills (eval week) → eval.

| Round | Skills | Task | Micro-game | First seen |
|---|---|---|---|---|
| Vocal | Listening, writing | Song 1 "좋아요". Dictate two lines, answer comprehension | Lyric dictation (tier 1 pick / 2 blocks / 3 type) | Noraebang lyric reading (#384); Tong Review |
| Dance | Listening | Follow the call: directions, body parts, numbers, actions. 오른손 들고, 왼쪽으로 두 칸! | Formation grid: follow the call | Daily practice with Coach Park |
| Judges | Writing, speaking | Trainee profile form (이름, 국적, 생년월일, 취미, 특기), then interview with follow-ups: 가족이 몇 명이에요? 주말에 보통 뭐 해요? 한국 날씨는 어때요? | Form fill + interview (input ladder #390) | H1 (introductions), agency paperwork on day 1 |
| Field quest | Speaking, listening | **Team lunch run.** Order for five from the group chat at the 분식집: 김밥 두 줄하고 떡볶이 일 인분, 라면 두 개 주세요. Pay 이만 원 from your wallet. Wrong counters → wrong food reaches the studio; teammates react | Ordering + wallet (#386) | J0 ordering, convenience store, menus |

Nationality and answers come from the player's creator choices, never hard-coded.

## Eval 2: Schedules (April · TOPIK 1)

**Can-do:** daily routine, time, days, plans. ~800 words.

**Month spine:** month opens with the weekly timetable posted (k01) → cherry-blossom night (after two hangouts) → H3 sneak-out by accident (#399) → eval week → eval.

| Round | Skills | Task | Micro-game | First seen |
|---|---|---|---|---|
| Vocal | Listening, speaking | Song 2 "일곱 시". Lyric relay: the music cuts and you supply the next line (아침 일곱 시에 일어나요 / 여덟 시에 ___ → 연습해요), then order the day's events | Lyric relay + sequence sort | Noraebang; Haeun humming in the studio |
| Dance | Listening | Calls tied to counts: 다섯에 왼쪽, 일곱에 돌아! | Formation grid: counted calls | Daily practice (H2 counting carries over) |
| Judges | Reading, speaking | Read the weekly timetable, answer (수요일 오후 세 시에 뭐 해요?), then talk about plans (이번 주말에 뭐 할 거예요?) | Timetable read + interview | Morning board, k01 schedule thread |
| Field quest | Reading, writing | **Book the practice room.** Read four teammates' free times in the group chat, check the room board (B룸 오후 2시~4시 예약 가능), post 토요일 오후 두 시에 B룸에서 연습해요! Wrong slot → half the team at a locked room | Group-chat reading + posting (#369) | Kakao threads all month |

## Eval 3: Phone calls and favours (May · TOPIK 2)

**Can-do:** make and take calls, ask and offer favours, ask someone to repeat. ~1,200 words.

**Month spine:** month opens with Manager Choi's new rules after a fan incident (k06 curfew) → phone battery and texting become a thing → H4 "나와." can open late in the month or slip to June → eval week → eval.

| Round | Skills | Task | Micro-game | First seen |
|---|---|---|---|---|
| Vocal | Listening, writing | Song 3 "같이 있어요". 놀토-style dictation: hear [가치 이써요], write 같이 있어요; the phonetic spelling scores zero | Lyric dictation, linked sounds | Tong micro-lessons on 연음 at signs and menus |
| Dance | Listening | Polite requests at speed mixed with commands: 두 칸 뒤로 가 주세요! 하은 씨랑 자리 바꿔 주세요! | Formation grid: request calls | Daily practice |
| Judges | Listening, speaking | Audio-only call: the manager moves tomorrow's call time (내일 촬영이 일곱 시로 바뀌었어요. 여섯 시 반까지 로비로 와 주세요). Q: 몇 시까지 어디로 가요? Then call back with a favour: 죄송하지만 보컬 레슨을 목요일로 바꿔 주실 수 있어요? Tier 1 sees a transcript; tier 3 may ask 다시 한번 말씀해 주시겠어요? once at a small fluency cost | Phone call (audio only) | Ordering by phone (#384), Manager Choi calls |
| Field quest | Speaking, listening | **Locked out.** See below | Favour + digits by ear | — |

**Locked out.** A fan found the dorm, so Manager Choi changed the door code this afternoon and posted it in the group chat. You knew it was changing; the new code landed after your phone died. It's 22:40, curfew is 23:00, and night check follows.

1. You punch the old code from habit. The lock: 비밀번호가 틀렸습니다.
2. At the 편의점 by the station, ask the night-shift worker a favour: 죄송한데 전화 한 통만 써도 될까요?
3. Call a teammate: 미안한데 새 도어락 비밀번호 좀 알려 줄 수 있어? (or 존댓말 if you aren't close; register is noted, not marked)
4. Catch six digits read fast in Sino numbers plus the star: 공팔이사칠일 별표. A misheard digit means another call and another favour.
5. The worker is Sua. She knows exactly who you are (you took her spot). You don't know who she is. She lends you a charger cable too, and doodles on the receipt.

**Daily micro-games needed by evals 1–3**

| Micro-game | Daily home | Evals |
|---|---|---|
| Formation grid: follow the call (directions, counts, requests) | Practice studio with Coach Park | 1, 2, 3 |
| Lyric dictation (pick / blocks / type) | Noraebang, Tong Review | 1, 3 |
| Lyric relay + sequence sort | Noraebang, studio | 2 |
| Form fill + interview (input ladder) | Agency, H1 | 1, 2 |
| Timetable and room-board reading | Morning board, studio door | 2 |
| Group-chat reading and posting | Phone (#369) | 2, 3 |
| Ordering + wallet | 분식집, convenience store, pojangmacha | 1 |
| Audio-only phone call | Ordering by phone, Manager Choi | 3 |
| Block crush | Signs, Tong Review (exists) | all, tier 2 |

## Evals 4–12 (draft)

Kept as in the source design and not built yet. Each gets tuned once evals 1–3 have played. Known edits already agreed:

- The group forms earlier than eval 9: survivors of the eval 6 cut become the unit; eval 9 adds the name, positions and fandom; eval 12 sets the final lineup size.
- Eval 7's "shout in silence" is on hold (tbc).
- Names must be canon (no 지수 unless added); answers about the player's family follow creator choices.

See the source doc for the round tables of evals 4–12.

## How results feed the story

| Output | Built from | Affects |
|---|---|---|
| Monthly rank | Each eval's grade vs the trainee roster | Story beats, management's view of you |
| Group score | Group rounds in evals 6, 8, 10, 12 | Final lineup size |
| Mastery per skill | Successes at your tier or above | Options in key conversations |
| Weak objectives | Per-objective accuracy | Next month's daily scenes are seeded with them |
| Haeun's score | Her base curve, plus your practice sessions with her, minus the times you lean on her | Whether she debuts; the center battle |
| Make-up evals | Missing an eval (Jeju) | Harder solo eval; passing restores rank |

## Minimal verifiable outcome: evals 1–3 loop

**A fresh Seoul save plays from H0 to eval 3 results night, in the browser and in the harness, with the same seed giving the same outcome.**

Done when:

1. **Chapter state.** Month 1–3 with spine beats, eval week trigger, point-of-no-return prompt, per-round autosave. Unit tests for gating and the resume rule.
2. **Day loop.** Bed → diary → morning board; 기력 drains and restores; condition face from bedtime; Tong pauses time. Unit tests for sleep-quality math.
3. **Eval runner.** Four rounds + results, tiers 1–2 (tier 3 typing for dictation only), scoring and bands, Tong-hint cap. Unit tests for scoring.
4. **Micro-games.** The table above, each playable in daily life before its eval.
5. **Content.** Three songs (audio + line timing map), three field quests, eval 1–3 item banks tagged by skill and objective, Sua's first appearance in eval 3.
6. **Results.** A ranking board with a stub trainee roster (4–6 NPC curves), probation scene on D/F, weak objectives seeding month 2 and 3.
7. **Unlocks.** At least one hangout and one place that open only after eval 1 and eval 2 (unlock map).
8. **Proof.** Lab harness replays two presets (beginner tier 1, strong tier 2) from H0 to eval 3 results and asserts grades, flags and unlocks; one recorded browser run of eval 1 end to end on laptop and phone width.

Out of scope for the loop: tier 3 free speaking, phoneme-level pronunciation, evals 4+, full trainee roster and cut logic.
