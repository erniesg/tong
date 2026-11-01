# Seoul Day 1: Incheon to the dorm

Source: "Tong — Seoul Day 1 Onboarding Script" (Chen Enjiao, 2026-11-01), reconciled with canon. The design rules below are the script's; the scenes follow the script except where canon or reality disagreed. Built on `feat/seoul-day1` (issue #435). Open items are in [`seoul-evals-tbc.md`](seoul-evals-tbc.md) (T19, T20).

## Decisions (2026-11-01)

- **Rooming stays T17.** Haeun is in another room. You room with 다온 Da-on (youngest) and 보람 Bo-ram (oldest).
- **The language road is the all-stop to 홍대입구.** The agency is in Hongdae and only the all-stop (일반) stops there. The express (직통) runs nonstop to Seoul Station, so it is the trap.
- **Lockers are part of orientation.** H0 (Sua's label, the notebook, Haeun's glimpse) plays at the end of orientation, then the registration card.
- **Tong is the floating mascot** (the 3D Tong). Nobody else can see or hear it; at most people notice you glance at nothing, mutter or recite. H1, H2 and Jin's lines that treated Tong as a phone app are rewritten.
- **The formation drill is on day 2,** first practice with Coach Park.
- **Origins are picked at the start,** in the creator ("Before Seoul, you were").
- **The hidden counter is `toll`** (`tally.toll`), read as Debt, Exposure or Strain.
- **No new exercise types.** Signs, the board and the stop use block crush; asking the way and the self-introduction use `sentence_builder`.
- **No kitchen scene.** Haeun doesn't cook for anyone.
- **The agency talks about Sua leaving** (orientation, overheard). Who left and when, never why or where (T10).
- **No Day 1 rival** (was T21). Minji, the gossip, says "쟤가 새로 온 애야?" to Yerin. Do-hee stays Haeun's rival.
- **Haeun stays unnamed on day 1.** Her speaker label is "연습생 Trainee" until H1, where you read her name on the water bottles. H1 can't start before day 2.
- **The Today list opens by itself on day one,** so all seven steps are visible.
- **Named characters:** the cohort, Manager Choi and Coach Park use canon names. One-off NPCs (passer-by, driver, fan) stay unnamed.

## Design rules

From the script:

- Day 1 runs from Incheon to bedtime. Every origin can arrive early by its own shortcut (always early, adds to `toll`) or by the language road (read the board right and you're early with no toll; miss it and one rescue decides on time or late).
- Arrival timing is early, on time or late. Each one shows the player something the other two don't.
- Origins on Day 1 change who reaches out and what's expected of you. Perks and weekly loops start on Day 2.
- The Hangul track teaches a few letters at a time, always reusing letters already met. Eval 1 doesn't test Hangul reading.
- Tong teaches in exercises and in opt-in Tong moments (the ride in, bedtime). Tong never comments on character scenes.
- Characters don't explain themselves.

## The train times

From Incheon T1 (typical; they vary by timetable):

| Way | To Hongdae | In the game |
|---|---|---|
| All-stop (일반) to 홍대입구 | ~50 min | Early: 홍대입구역 2:25 |
| Express (직통) to Seoul Station, back two stops | ~43 min + change + ~10 min | On time: 2:50, if a stranger helps |
| Airport bus in traffic | 70–90 min | Late: 3:12, at the studio 3:20 |
| Taxi | ~60 min, about ₩60,000–75,000 | Early: 2:30 on the main road |

## What plays

| # | Where | Scene | Built as |
|---|---|---|---|
| 1 | Incheon arrivals (hidden level at x −400) | Tong appears; Manager Choi's 3pm text; the origin's message | `seoul.d1.airport`, plays on a new game |
| 2 | The 입구 / 출구 doors | Block crush 출구; the doors open | `seoul.d1.exit` |
| 3 | The departure board | Read the board (block crush 일반), or the origin's shortcut; the express and the Seoul Station rescue; the bus; Tong's ride-in moment in the train car; block crush 홍대입구 | `seoul.d1.station` |
| 4 | Hongdae | Up at 홍대입구역 (or the main road by taxi); walk to the studio | `arriveHongdae()` |
| 5 | The studio | Early: Haeun alone. On time: the cohort. Late: Bo-ram covers | `seoul.d1.arrive` |
| 6 | The studio | Rules; "첫 월말평가는 이번 달 말"; self-introduction; the origin beat; Sua gossip; "your locker" | `seoul.d1.orientation` |
| 7 | Lockers | 수아 label, the notebook, Haeun's glimpse, Coach Park: tomorrow at 10 | `haeun.h0` |
| 8 | — | Registration card | built |
| 9 | The dorm | Sua's bed offered and deflected; Da-on and Bo-ram; stay up talking (costs 기력 and an hour) or sleep early | `haeun.h0.dorm` |
| 10 | Your bunk, after 20:00 | Tong: Bo-ram's 반말, Yun-seo's 고생 많으셨죠 (on time only), 언니; then the Hangul recap; sleep | `seoul.d1.bedtime`, `hangul_recap` |

When an exercise is closed, or can't run without the Tong host, the scene sets `ex_<beat>_skipped` and offers a plain choice instead (pick the row, say the line), so a closed panel never decides the arrival time.

Origin shortcuts (choices tagged [Athlete], [Creator], [International-School Kid]):

| Origin | Shortcut | Sets |
|---|---|---|
| International-School Kid | Taxi on the family card; the driver's small talk | `d1_taxi`, `toll_family_card`, toll +1 |
| Athlete | Sprint for the all-stop that's boarding; "Splits?" | `d1_tight_calf`, toll +1 |
| Creator | A fan walks you to the train; the photo (yes +2, no +1, she posts it either way) | `pr_photo`, toll +1 or +2 |

## Hangul on Day 1

The tracker counts the 24 basic letters in the words you actually rebuilt (`hangul:<word>` flags) and the signs you read (`hangul.js`). On the language road:

| Word | New letters | Total |
|---|---|---|
| 출구 | ㅊ ㅜ ㄹ ㄱ | 4 |
| 일반 | ㅇ ㅣ ㅂ ㅏ ㄴ | 9 |
| 홍대입구 | ㅎ ㅗ ㄷ (ㅐ isn't one of the 24) | 12 |
| 입니다 | none new | 12 |
| 수아 | ㅅ | 13 |
| 연습실 (studio sign, if read) | ㅕ ㅡ | 15 |

Shortcut riders skip the board, so they end the day a couple of letters lower. The bedtime recap lists each letter with the word it came from.

## Day 1 flags

| Flag | Set in | Pays off |
|---|---|---|
| `d1_early` / `d1_ontime` / `d1_late` | Station | Arrival version; bedtime questions |
| `gave_haeun_space`, `filmed_haeun_d1` | Arrival, early | Trust |
| `tally.toll`, `toll_family_card`, `d1_tight_calf`, `pr_photo` | Shortcuts | Origin crises |
| `minji_talked_back` | Arrival, on time | Minji's view of you |
| `boram_ally` | Arrival, late | Bo-ram before her eval 6 cut |
| `intro_formal` / `intro_casual` | Orientation | The cohort's first impression |
| `heard_sua_left` | Orientation | Sua's line (T10) |
| `d1_stayed_up` | Dorm | Starts day 2 lower |
| `hangul:<word>` | Every exercise | Tracker, Tong's Review |

## Not built yet

- The Athlete's sprint as a rhythm-tap mini-game (the script's preview of the dawn drills); for now it's narrated.
- Ride-in answers making the matching block glow in the self-introduction.
- The cohort in the studio are stand-in figures (generic trainee models) until the cohort has its own looks.
- Day 2: each origin's weekly loop, and the formation drill with Coach Park.
