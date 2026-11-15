# Seoul first day, rebuilt

Rebuild of the first quest (branch `feat/seoul-first-quest`). It replaces the Incheon hall, the 출구 doors and the departure board from [`seoul-day1.md`](seoul-day1.md); the studio scenes, the lockers, the registration card, the dorm and bedtime stay, restaged. Canon is unchanged (`apps/client/lib/content/canon/`); things this adds that canon doesn't have yet are listed under [Proposals](#proposals).

## The request (owner, 2026-11-14)

> tong cozy leaves a lot of room for improvement: the graphics/visual does not look cozy or rich enough; i find the size of text and the way korean is introduced very problematic also, like it can be throwing too many foreign hangeul one after another all with the same block crush exercise insead of varying things, establishing a fun game/learning loop, and building on enough repetition or building blocks; the entry w the conveyor and mrt is also just weird cos there's no one around and the visuals is too basic; then when you report, why is the company one room only shouldnt it have multiple rooms and floors, the scene or how ppl enter/mill about is also poorly written and abrupt, the use of origins is not well thought-out and organic to the gameplay too; can you fix these issues and make it really fun, we can redo/rebuild the first quest; i just feel like the onboarding or first quest should immediately throw people into the heart of the game so they get what it's about right away (dating / life sim for language learning) and are quickly acquainted with intriguing characters that'll make you want to play on; the learning should be thoughtful and organic to the experience too, like we should be able to hover over hangeul and see their romaniticsation, play the sound like in the mobile version of the game; for now though i want to make the cozy game really really awesome, please research and use screenshots if necessary to enhance the gameplay and visuals

Follow-up, same day:

> errr i want you to write the haeun scene also so onboarding could be jin/haeun on day 1 and then depending on who u see first can kind of continue from there ah kind of like point being ya i want you to meet either jin or haeun immediately and if u dun see one first u'll still hangout/run into them another time so meeting the romantic interest to set the tone make sure we start the game/intro properly; u can decide on the drama title

## What changes, by complaint

| Complaint | Change |
|---|---|
| Not cozy or rich | Day one starts at 4:20pm, so it plays in golden hour, dusk and lamplight. Softer shadows, warmer ground and light. People on the street. New sets are dressed, not boxes. |
| Text too small | Base sizes go up one step everywhere (dialogue Korean 26–34px, English 18px, lists 16px). |
| Too much Hangul, one exercise | Eight letters on day one, two or three at a time, each new word built from letters already met. Five different small games in rotation. Shop signs are no longer jumbled and no longer open block crush; the floating word pickups wait until day two. |
| Empty conveyor and MRT | The airport hall, the doors and the board are cut. The game opens seated on a full airport train a minute from Hongdae, then on a busy street. |
| Company is one room | Onsae is a three-floor building: lobby, practice rooms A and B off a corridor, lockers, vocal booth and lounge upstairs. |
| People enter abruptly | Everyone is heard or seen before they speak: Coach Park's count through a door, the cohort coming out of practice in twos, Jin on a poster in the lobby hours before the tent. |
| Origins not organic | No more one-off tagged shortcut at a ticket machine. Each origin has a perk you use in the world on day one, a person who reacts to it, and a cost. |
| Heart of the game, fast | First Korean spoken to a person inside the first minute. Out of the station two places are lit, and each is a first meeting: straight up to Onsae is Ha-eun, alone in Room B; the tent on the food street is Jin, on the next stool. Whoever you don't meet first, you run into later the same day or the next. |
| Hover Hangul | Every Korean word in dialogue, replies, hints, lists and the phrasebook shows its romanisation and meaning on hover or tap, and plays its sound. |

## The day

Day one is Sunday 1 March. Times moved two hours later than the old script so the cohort is finishing practice when you walk in.

| # | Where | What plays | Scene |
|---|---|---|---|
| 1 | The airport train, 4:20pm | Seated, the car full. Tong appears. The grandmother beside you offers a tangerine: your first Korean to a person. Manager Choi's text: the company by five. The message from your old life. The stop is called. | `seoul.d1.train` |
| 2 | Hongdae, by the station, 4:25pm | The street is busy. Tong: Onsae is up the stone stairs, by five. Your stomach: the tent is already steaming. Jin's drama poster on the station wall. The 붕어빵 cart and the busker are on the way. The Creator's fan catches up here. | `seoul.d1.street`, `seoul.d1.poster`, `seoul.d1.cart`, `seoul.d1.busker` |
| 3a | **Ha-eun first:** straight up to Onsae | Lobby: nobody at the desk, the artist wall, the floor guide. 2F: Coach Park counting behind Room A's door; Room B ajar, one girl alone, missing the turn on seven. Watch, wait outside, or count her in. Practice lets out; she answers Da-on in 반말, laughing; then the wall again. | `seoul.d1.lobby`, `haeun.d1.room_b` |
| 3b | **Jin first:** the tent | One stool left, next to a man in a low cap. He rescues your order, asks where you're headed ("…온새."), proposes 반말, pays. Then Onsae: his face is the biggest frame on the lobby wall. On 2F practice is letting out; Ha-eun is one glance. | `jin.j0`, `seoul.d1.lobby`, `seoul.d1.arrive` |
| 4 | Practice Room A, 5pm | Orientation: the rules, the first monthly eval, your introduction, what your origin makes of you, Su-a's name in the room. | `seoul.d1.orientation` |
| 5 | 3F lockers | Su-a's half-scraped label, the notebook, Ha-eun's glimpse. | `haeun.h0` |
| 6 | — | Registration card. | built |
| 7 | The evening | Yours until curfew. If you haven't eaten, the tent is where Jin is. The dorm is in Yeonnam. | `jin.j0`, `haeun.h0.dorm` |
| 8 | Your bunk | Tong's bedtime moment and the day's letters. | `seoul.d1.bedtime` |

### Who you meet first

| You | First meeting | The other one |
|---|---|---|
| Go straight up | Ha-eun, alone in Room B, a full scene. Still unnamed: her name is on the water bottles tomorrow (H1). | Jin at the tent that evening or any night; his face is already on the lobby wall. |
| Eat first | Jin at the tent, a full scene. | Ha-eun is a glance in the corridor and at the lockers; her scene is H1 tomorrow morning, paired by Coach Park. |

### Time

Walking never moves the clock on day one. The tent takes twenty-five minutes, the busker's song twelve; the cart is free.

| On the way | You reach the second floor at | Flag |
|---|---|---|
| Nothing, or only the cart | 4:35 | `d1_early` |
| The tent | 4:58 | `d1_ontime` |
| The tent and the busker's song | 5:20 | `d1_late` |

An origin perk used on the street (below) means you are never late, and adds to `toll`.

## Origins on day one

Still picked in the creator. Each one is something you can do, not a label.

| Origin | On the train | Perk on the street | Who reacts | Cost |
|---|---|---|---|---|
| Athlete | Your old teammate: "Don't get soft." | Take the terrace stairs at a run with the suitcase on your shoulder. | In Room B you can take the turn on seven beside her, cold, and land it. Coach Park: "내일 앞줄." | `d1_tight_calf`, toll +1 |
| Creator | Notifications; the student across the aisle keeps looking. | She catches you up outside the station. The photo: yes or no, she posts either way. In Room B you can ask to film (she says no) or just raise the phone. | Min-ji has already seen it. Manager Choi: none of that from today. | `pr_photo`, toll +1 or +2 |
| International-School Kid | Mum: take a taxi on the card. | The taxi at the rank, round the block to the door. In Room B you can offer to buy her a drink. | Manager Choi mentions your parents rang, in front of everyone. | `toll_family_card`, toll +1 |

## Korean on day one

### Letters

| When | Word | New letters | Game | Total |
|---|---|---|---|---|
| Train | 아 (from the grandmother's 아이고) | ㅇ ㅏ | Build 아 from two pieces | 2 |
| Onsae lobby | 이 (the floor guide: 2층 is 이층) | ㅣ | Hear it, pick it | 3 |
| Room B (if you offer) | — | — | Count her in: 다섯, 여섯, 일곱, 여덟 in order | 3 |
| Lockers | 수아 (the scraped label reads ㅅ…아) | ㅅ ㅜ | Find the missing piece | 5 |
| Dorm | 다온 (the name card on the bunk above yours) | ㄷ ㅗ ㄴ | She says her name; pick her card from three | 8 |
| Bedtime | 아이, 수아, 다온 | — | Match each to its sound | 8 |

Day two's first read is 하은 on the water bottles (H1): two new letters, three known.

### Said, not spelled

Heard and said in replies, with romanisation and sound, each at least twice: 안녕하세요 (the grandmother, the corridor, your introduction), 감사합니다 (the tangerine, the cart, Bo-ram), 하나 주세요 (the cart), 저는 {name}입니다 (your introduction, built from three pieces), and Coach Park's 다섯, 여섯, 일곱, 여덟 through the door.

### The loop

Meet a word where it lives (a voice, a label, a sign) → hover or tap it for sound and meaning → one small game, a different kind each time → use it on a person, who reacts → it comes back before bed.

Every game card keeps Tong's explanation on it, shows romanisation under the pieces of a line, and ends by showing how the word is put together (다 = ㄷ d + ㅏ a).

A wrong answer never fails anything: the character says it again or Tong points, and the scene goes on. Your introduction is the exception by design: what you put together is what you say, and the room reacts to it.

## Proposals

Added here, not in canon yet. Say if any should change.

- **Jin's drama** is 〈밤의 끝에서〉 *At the Edge of Night*, weekends at nine (owner: your call).
- **The tent opens at four**, not seven, so Jin can be the first person you meet.
- **Jin hears you're headed to Onsae** on day one and says only "…온새." (he trained there; canon).
- **Ha-eun's first scene** is `haeun.d1.room_b`. She stays unnamed; nothing in it goes past her wall. She tells you, politely, to wait in the corridor; staying is your choice.
- **After a day-one meeting Jin is away until tomorrow** (the café and the river start on day two).
- **The grandmother on the train**, the **붕어빵 seller** and the **busker** are unnamed one-offs.
- **Orientation at 5pm** (was 3pm), day-one start 4:20pm.
- **Arriving late** now only happens if you eat at the tent and also stay for the busker's song.
- **Onsae's floors**: 1F lobby; 2F practice rooms A and B; 3F lockers, vocal booth, lounge.
- **Su-a's and Da-on's names** are the first names you read. Ha-eun's stays for H1.

## Built as

- `public/cozy/js/onsae.js`, `level-support.js` (`layout: 'agency'`): the building.
- `public/cozy/js/cities/incheon.js`: now only the train car. `public/cozy/js/hongdae-life.js`: the street.
- `public/cozy/js/gloss.js`: hover and tap lookups. `public/cozy/js/romanize.js`: romanisation.
- `public/cozy/js/tongplay.js`: the small games (exercise types `hangul_compose`, `hangul_listen`, `hangul_missing`, `hangul_match`, `say_it`).
- Scenes in `lib/content/routes/seoul/d1-*.ts`; proof `scripts/cozy-day1-browser.mjs`.
