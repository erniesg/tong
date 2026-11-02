# Seoul Day 2: first practice and the origin loops

Built on `feat/seoul-day2` (issue #435, after [Day 1](seoul-day1.md)). Day 2 is the first practice with Coach Park and the day each origin's weekly loop starts ([`seoul-origins.md`](seoul-origins.md) "Origin loops"). Open items are in [`seoul-evals-tbc.md`](seoul-evals-tbc.md).

## Decisions (2026-11-02)

- **The calendar:** day 1 is Sunday 1 March, so day 2 is a Monday and every loop has a weekday.
- **The formation drill follows H1.** H1 ends on Ha-eun's "수고하셨어요~"; everyone reaches for water and Coach Park claps: "아직 안 끝났어. 대형!" It's the grid eval 1's dance round remixes, at tier 1 and ungraded. Daily practice after that is the schedule board's 리허설.
- **The grid runs inside scenes** as the exercise type `formation_grid` (run by the cozy runtime, never sent to the Tong host). Its targets are the kinds of call: `move`, `pose`, `combo`. It's the same grid as the eval, not a new game.
- **Each loop is weekly and reuses existing systems.** No origin gets a separate game.

| Origin | Loop | When | Plays | Builds |
|---|---|---|---|---|
| Athlete | Dawn run (`seoul.loop.dawn`) | Mondays 05:30, after the morning board | Run alone, or wake Ha-eun, Min-ji or Ye-rin (once you know names), or sleep until seven. The run is the grid, moves only, with Tong calling | `tally.team_<name>`; `tally.dawn`; running tired adds `toll` (strain) |
| Creator | The edit (`seoul.loop.edit`) | Monday nights, at the bunk before sleep | Caption a clip (block crush, 도착 the first week), then the archive or a secret account | `tally.footage`; `edit_archive` / `secret_account` (posting adds `toll`) |
| International-School Kid | Sunday call (`seoul.loop.family_call`) | Sundays at 10 from day 8; Mum sets it on day 2 (`seoul.d2.mum_text`) | News, Dad asks to see the room, Mum offers a favour, then "how do you say thank you properly" (block crush 감사합니다) | Taking the favour adds `toll` (debt); `tally.family_call` |

- **The Creator's first edit is the month-1 posting-ban choice:** the archive or a secret account. Sending footage to someone specific opens later (Ha-eun, then her mum).
- **The Athlete is sent to the front row** in the drill ("앞줄. 어제 말했지."), paying off orientation.
- **The Sunday call mirrors Ha-eun's:** across the roof, someone else is on a call in a dialect you don't know.

## The cohort's looks

- Each cohort member and the two staff have a fixed look in the creator's format (`cohort-looks.js`), chosen from their canon role: Da-on (15) pigtails and a pink hoodie; Bo-ram (22) short hair, dark tee, track pants; Do-hee (ex-survival) dyed-pink waves, cream knit; Minji a bob, green hoodie, red trainers; Yerin a ponytail and glasses; Yun-seo long black hair, cream jacket; Coach Park a buzz cut and cap. None of this is canon.
- **Manager Choi is drawn as a woman** (she runs the girls' dorm and does the night checks). A proposal: canon doesn't say.
- From day 2 the cohort and staff are in the studio 10:00–18:00; Da-on only from 14:00 (middle school in the mornings).

## Flags and counters

| Flag / tally | Set in | Pays off |
|---|---|---|
| `drill_clean` / `drill_rough`, `d2_drill_done` | `seoul.d2.drill` | Coach Park's view of you |
| `dawn_seen`, `tally.dawn`, `tally.team_haeun` / `team_minji` / `team_yerin` | Dawn run | Team trust (the Athlete's earned power) |
| `edited_once`, `edit_archive`, `secret_account`, `tally.footage` | The edit | The footage library (the Grandma video); exposure |
| `family_call_set`, `family_called`, `family_favour` / `declined_favour`, `tally.family_call` | Mum's text, the call | Family standing; debt |
| `hangul:도착`, `hangul:감사합니다` | The edit, the call | The Hangul tracker (도착 reuses only letters already met) |

## Not built yet

- Giving instructions on the dawn run (you call the moves for a teammate).
- The Athlete's dawn perks beyond the weekly run: daily 5–7am, slower drain, pool access.
- Where the footage goes to "someone specific", and the fan comments on the secret account (reading practice).
- The family call in the player's home language beyond English.
