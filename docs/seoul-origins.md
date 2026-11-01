# Seoul player origins

Source: "Tong — Player Origins PRD" (Chen Enjiao, 2026-11-01). This is the working copy; the PRD text is kept as written, and [Where this meets canon](#where-this-meets-canon) at the end lists the points that need an owner call before they are built. Canon is in `apps/client/lib/content/canon/`; the year is in [`seoul-evals.md`](seoul-evals.md); routes in [`relationship-plan.md`](relationship-plan.md).

## Summary

Tong ships three player origins (Athlete, Creator, International-School Kid) for the Seoul route. Each gives the player an everyday privilege, a crisis that privilege builds toward, and one outcome only that origin can bring about.

The shared premise is fixed: you are a foreign trainee handpicked for possible debut alongside Haeun, inheriting Sua's lineup spot. Every origin starts as a clean slate to the industry. Origins change *how you live the same year*, not the year itself.

**Goals**

- Each origin earns its own playthrough: a player who finishes one wants to replay as another.
- Origins matter all year, not just in the prologue (the gap in Cyberpunk's lifepaths).
- Privileges are tempting and always cost something.
- Evaluation results come from player skill in the minigames, never from origin stats.
- Production stays bounded: shared spine, short vantage scenes, per-origin codas.

**Out of scope:** Shanghai and Tokyo origin variants, Jin-route origin content beyond one note per origin, origin selection UI.

## Design principles

1. **An origin is a position, not a motive.** It sets who you know, what you can reach, what you owe and how others read you. It is not personality, nationality or language level.
2. **Origins change outcomes, not scores.** Singing and dancing results come from how the player performs. Origins never buff evaluation stats.
3. **Every privilege bites back.** Each everyday perk feeds a hidden counter that builds toward that origin's crisis.
4. **Each origin can change one fate no other can.** No single playthrough can save everything. This is the main replay hook.
5. **Exclusive options must be earned.** The power is established early at low stakes, built through play, then offered at a critical moment.
6. **Language mastery is the way out of a crisis.** Low mastery means someone speaks for you (the repo's `assist` default). High mastery gives you control and better options, which still cost something.
7. **No coincidence twists.** Origins are not secret guilt tied to the main mystery. Stakes come from what you do with your privilege during the year.

## Origin anatomy

| Part | Athlete | Creator | International-School Kid |
| --- | --- | --- | --- |
| Everyday perk | Stamina: daily attributes drain slower, less sleep needed; free gym and pool access | Recognition: strangers warm up faster, people agree to meet you, places open up (the café back room) | Taxis, delivery, private tutor, team dinners, family-dinner passes |
| Resource it buys | Energy | Social reach | Convenience and legitimate nights out |
| Hidden counter | Strain | Exposure | Debt |
| Crisis it builds to | An injury, yours or Haeun's or both, before a group evaluation | PR crisis | Family ultimatum |
| Earned power | The team (time with other trainees) | Haeun's mum (filming with consent, then the video for Grandma) | Your family's help (keeping the relationship alive) |
| Unique fate | Everyone debuts; no one is cut | Grandma sees Haeun perform before she dies | Haeun doesn't have to choose between Seoul and home |
| Funeral messenger | Coach Park | Haeun's mum | Management talk you overhear |
| Crisis language test | Team instruction, physio talk | Public statement register | Formal business negotiation |

## Origin loops

Each origin has one light weekly loop that keeps it present between story beats: a low-stakes mini-game, language practice, and upkeep of who you were. Loops reuse existing systems; no origin gets a separate game.

| Origin | Weekly loop | Mini-game | Language practice | Identity upkeep | Builds |
| --- | --- | --- | --- | --- | --- |
| Athlete | Dawn sessions and drills: choose who to train with (Haeun, Minji, Yerin) or rest | Training | Giving and following instructions | Still an athlete | Team trust; strain if overdone |
| Creator | Edit session: cut clips from the camera into something short | Cutting and subtitling | Writing captions, translating between your languages | Still a maker | Footage library; reach and exposure if posted |
| International-School Kid | Sunday family call: news, a request, a favour offered | Conversation | Family register in your home language | Still your family's child | Family standing; debt when you accept |

**Shared feature, camera mode:** every player can take photos and clips during hangouts, with consent prompts. Only the Creator can edit footage into a finished video, which is what makes the Grandma video possible.

**Where the Creator's edits go** follows the month-1 choice about the posting ban:

- **Private archive:** safe; builds the library that becomes the Grandma video.
- **Secret account (if kept):** fans comment in Korean slang (reading practice); gains reach, builds exposure.
- **Someone specific:** Haeun, later her mum; builds that relationship.

The International-School Kid's Sunday call mirrors Haeun's Sunday call from Grandma: two people on the rooftop on Sundays, each talking to home.

## Athlete

The Athlete's fate is keeping the whole group together: with enough team trust, nobody is cut and everyone can debut.

**Who:** a foreign former national-team athlete (sport TBD), retired young. Your career has already ended once.

**Why you were picked:** a scout saw your last competition or a gala: body control, stage presence, nerves that hold. A retired athlete is also a story the agency can sell.

**How you differ from Haeun:** she is the all-rounder ace still on the path. Your career has already ended once.

**Everyday perk (Energy):**

- Your daily attributes drain slower, and you can skip sleep with less of a crash.
- Dawn runs open a 5–7am slot nobody else has: Han River at sunrise, early practice.
- Old sports contacts give after-hours pool access, which unlocks the swim date with Haeun early.
- Check: dawn time with Haeun only works if she isn't exhausted. Push her onto your schedule and she burns out.

**Counter, Strain:** each push adds strain. Strain never changes scores; it makes minigames harder (smaller stamina meter, tighter timing windows), then triggers an injury event that can bench you for an evaluation.

**Earned power, the team:** time spent running warm-ups with Minji and Yerin, spotting who is limping, drilling someone's weak count. It builds **team trust**, at the cost of time with Haeun or your own practice.

- **Absences covered:** if you and Haeun leave for the funeral, a high-trust team has already been set up to rework the formation and hold the group evaluation without you.
- **A cut prevented:** around month 8, Yerin overtrains and is injured. By default she is cut. Only the Athlete can see it coming and get her to rest.

**Crisis, the injury (months 5–6):** someone gets hurt before a group evaluation, and whose injury depends on how you played: yours if your strain is high, Haeun's if you pulled her onto your schedule or helped her hide pain, both if you did both. If it's hers, you are the only one who recognises how she is taping it:

- Tape it properly so she can perform: she gets through, and you have helped her hide pain.
- Tell Coach Park: she is benched and furious, and her body is protected.
- Tell her what an injury like this did to your career and let her decide. Only works if you have been honest about your retirement.

**Bites back:** the trainees start coming to you instead of Haeun, which becomes partnership or rivalry. Coach Park leans on you like an assistant coach, so you share the blame. Caring for everyone else costs your own preparation.

**Relationships:**

- **Haeun:** you can be proof there is life after a career ends, which makes Jeju a real choice for her. Or you teach her to push through everything.
- **Sua:** the only origin who understands quitting as retirement, not failure. That gives you a unique way to help reconcile her with Haeun.
- **Coach Park:** you know coaching culture, so you trust him faster, or spot when he crosses a line.
- **Old life:** your former coach, teammates still competing, and a coaching offer back home that stays open all year.

**Jin route:** sport has rules and referees; his world has neither. The leak hits your sense of fairness hardest.

## Creator

The Creator's fate is that Grandma gets to see Haeun perform before she dies.

**Who:** a foreigner scouted from a viral clip on Douyin, TikTok or YouTube, with an existing audience. You never auditioned.

**Constraint:** trainees cannot post. Contracts restrict social media and public appearances, so on Haeun's route the Creator's power is the camera and the audience, never publishing.

**Everyday perk (Social reach):** recognition. A café owner who is a fan lets you use the back room after hours as a private hangout spot. Strangers warm to you faster, and people who would ignore a trainee agree to meet you. No discounts: money is the International-School Kid's lane.

**Counter, Exposure:** every favour leaves a trace. Fans start turning up where you go. Check: the café back room is perfect until the owner posts a blurry photo captioned "guess who."

**Crisis, PR:** around months 5–6, tied to H6 (almost caught): too many sightings, and a fan account posts a photo that puts you and the agency in a corner, with the people around you caught in it.

**The camera:** you never stop filming, privately.

- Early: after an evaluation, Haeun can't see what's wrong. You show her the footage: she is perfect, but her face goes blank on stage. Being seen accurately is an intimacy only you can offer.
- Consent matters. Film without asking and she eventually finds the folder, a real breach for someone whose rooftop is where she goes to be nobody. Ask, and she starts letting you film what she shows no one.

**Earned power, Haeun's mum:** with enough trust and consent, you make a private video of Haeun's year for Grandma, who calls every Sunday and has never seen her perform. Haeun sends it home. Her mum sees who you are and starts messaging you.

**Signature moment, the mum's secret (month 11):** because her mum trusts you, she tells you Grandma is dying before anyone tells Haeun, and asks you to keep it quiet until after the evaluation. Keep the secret, as Sua once did, or tell Haeun and break her mum's trust.

**The fate:** if the video was made, her family tells Haeun that Grandma watched it every Sunday. If it was never made, that gap is the regret.

**Jin route:**

- **The upload trail (exclusive clue):** you can tell the leaked photo was seeded rather than shared by a fan: a new account, odd timing, coordinated early shares. It is a fifth piece of evidence for the Act 3 confrontation.
- **Post first (exclusive choice):** as the one with your own audience, you can post your account of the relationship before his drafted statement lands. It admits breaking the dating ban, and it wrecks his rescue.

## International-School Kid

The International-School Kid's fate is that Haeun doesn't have to choose between Seoul fame and home: the deal for her mum's restaurant in Seoul is struck during the year, and the restaurant opens after debut, in the epilogue.

**Who:** grew up moving between cities, international schools and your parents' professional circles. Spotted through a school event or an introduction. You understand affluent settings, have contacts across countries and have a financial fallback.

**Language profile:** fluent in English, school-level Mandarin, partial Korean or Japanese. Comfortable in boardrooms, weak in intimate and street registers. Your Korean is the weakest of the three origins.

**Everyday perk (Convenience and nights out):** taxis instead of the subway, delivery instead of queues, a private Korean tutor, buying the team dinner. Money buys comfort and services, never extra hours in the day or people's goodwill. Agencies grant leave for family visits, so your parents' Seoul dinners give you legitimate nights out, and you can bring a friend.

**Realism limits:** no separate living arrangement and no curfew exemption; the agency keeps trainees in the dorm. In Act 2 your family buys an officetel nearby "for when we visit." You can use it by day to rest, study or hang out; the dorm's 23:00 curfew and night check still apply. The risk is being seen: taking Haeun there alone breaks no rule, but a photo of it reads as dating.

**Counter, Debt:** every favour is owed back to your family, who collect through the leverage arc below.

**Haeun and money, reciprocity:** team dinners are fine. Jeju fares spike at Chuseok and she has no income, so she can't afford to go home then, and she quietly keeps score and pays you back in small ways: the convenience store ramyeon, splitting something cheap. Letting her pay you back is intimacy. Always refusing tells her she can't be your equal. Expensive gifts to her alone make her feel indebted (the gift rule already in relationship-plan.md).

**Family leverage arc:**

| Phase | Months | What happens |
| --- | --- | --- |
| Indulgence | 1–3 | Generous allowance; they treat it as a gap year |
| Trigger | ~4 | You let the university deferral they arranged lapse |
| Soft leverage | 4–6 | Conditional allowance, the officetel, a dangled job in Shanghai, family events booked on evaluation weeks |
| Crisis | 7 (Chuseok) | Family ultimatum: instead of summoning you home for the holiday, your parents come to Seoul (see Language) |
| Hard leverage | 8–10 | Through Haeun's family: the funding offer for her mum's restaurant (month 8). It arrives as leverage; how you have handled your family decides whether it becomes the epilogue's opening or a debt |

**Leverage is deniable, never a bribe.** No envelope of cash. The restaurant offer reaches Haeun's mum in Jeju as an ordinary pitch from an F&B fund. Nothing is conditional on paper, and the deal stalls "for review" whenever you defy them.

**Earned power, family help:** the call only goes through if you have kept the family relationship alive: calls, showing up, keeping some promises. Defy them all year and nobody is left to call.

**The fate, the restaurant:** with family backing and Haeun's trust, her mum agrees to the deal in Act 3. The restaurant opens after the ending, as the epilogue's first scene, with Sua working there. No other origin gets this epilogue.

**Its price:** your family's name is on the lease and they can call it in. Haeun has to accept that her mum's dream came true through the rich kid's family. Whether she can depends on whether you asked or arranged.

**Signature moment, the ultimatum:** see Language mastery. Its outcome decides whether the restaurant fate stays possible.

**Failure state:** mishandle the debt and lose the ultimatum (high defiance, the investor stake has surfaced, you leaned on family favours) and your family pushes the agency: both you and Haeun are locked out of debut, whatever your evaluations.

**Jin route:** your family's PR offers to bury the leak. Two men are trying to control your story.

## Shared spine and vantage

The 12-month calendar in `canon/world.ts` (March to February, one evaluation a month, final evaluation in month 12) is the same for every origin. Origins add short vantage scenes at a few beats and their own crisis; they never fork the spine.

| Month | Spine beat | Athlete | Creator | International-School Kid |
| --- | --- | --- | --- | --- |
| 1–4 | Acts 1–2 open | Pushing; team trust starts | The camera; sightings start | Indulgence, then the deferral trigger (~4) |
| 5–6 | H5, H6 | **Crisis:** the injury (yours, Haeun's or both) | **Crisis:** PR, tied to H6 | Soft leverage |
| 7 | Chuseok | Pool with Haeun, who stays in Seoul | — | **Crisis:** the ultimatum; your parents come to Seoul |
| 8 | H8 (Jeju slips out) | **Fate:** Yerin | Fate: the Grandma video | Fate: the restaurant offer reaches her mum, as leverage |
| 9–10 | H9, H10 | — | Mum's trust builds | The deal stalls whenever you defy your family |
| 11 | The funeral | Coach Park tells you | Haeun's mum tells you and asks for silence | You overhear management |
| 12 | Final evaluation | Debut decided by evaluations, gated by the crisis outcome | Same | Same |

Each origin gets one beat per act: Act 2 holds its crisis, Act 3 belongs to Haeun and Sua, Act 4 to the funeral and the final evaluation.

**The funeral, shared.** Haeun's family hides Grandma's death so she can focus on the evaluation, mirroring Sua's silence. Korean funerals usually run three days (삼일장), so being told late means missing it entirely. Seoul–Jeju flights are frequent and cheap, so getting there is not the stake. **Who learns in time, and whether they tell her,** is. The funeral scene is shared; only the messenger scene differs. Sua is the fallback messenger for any origin.

**Placement:** the funeral sits in month 11, before H11's decision, so it shapes how Haeun decides.

## Language mastery

Each origin's crisis tests a different kind of Korean, and mastery decides how much control the player has over the outcome. Failing defaults to `assist`: low mastery never blocks progress, it hands the decision to someone else.

| Origin | Crisis | Register tested | Low mastery | High mastery |
| --- | --- | --- | --- | --- |
| Athlete | Injury | Physio talk, team instruction | Coach Park benches you | You negotiate a partial role and direct the reworked formation yourself |
| Creator | PR crisis | Public apology and statement | The agency writes your statement; you read it out | You choose what you admit to, and who you protect |
| International-School Kid | Family ultimatum | Formal business negotiation | The agency's interpreter mediates; parents and CEO decide over your head | You speak for yourself to the CEO, or shape what each side hears |

**The ultimatum in detail (month 7, Chuseok).** Your parents (in your family's home language, chosen at character creation) meet the CEO and Manager Choi (Korean), with you in the middle.

- **Low:** an interpreter runs the room. You learn the outcome afterwards.
- **Mid:** you interpret roughly. You can soften each side, but can't make your own case.
- **High:** you interpret faithfully, spin it, or argue for yourself in proper formal Korean. Your parents see you work professionally in Korean for the first time.

**Outcomes:** negotiated (stay through debut, on one condition: if you don't debut at the final evaluation, you go home, so your not-debuted epilogue can't be another year of training; family support continues; restaurant fate stays open) · spun (works now, collapses if anyone compares notes) · lost (deal made without you: go home or cut them off) · cut off (you stay with no safety net; the restaurant fate is gone).

Across three origins and the existing beginner-to-fluent tiers, the same scene plays differently each time, which is a second replay driver.

## Endings and codas

Endings are Haeun's existing route endings (Opened, Armored, Stuck) plus a short origin coda decided by the origin's counter and signature choice. That is nine codas, not three sets of endings.

|  | Athlete | Creator | International-School Kid |
| --- | --- | --- | --- |
| Good | You both learned to stop. Your bodies made it through the year; nobody was cut. | Her mum still messages you every Sunday. You're family now. | You turned down your family's help when it counted. What you have with her is yours. |
| Mixed | You made it, and the epilogue shows what it cost. | Your fame got you both everything except privacy. | It worked, and every good thing carries your family's name. |
| Bad | You helped her hide the injury. She never tells you when something's wrong again. | The fan photos defined the year. She stopped going to the convenience store. | The debt was collected: neither of you debuts. |

**Your own debut:** decided by your evaluation performance. *Owner, 2026-11-01:* only the International-School Kid can lose debut whatever their scores (the lost negotiation locks out both you and Haeun), so that origin is high risk, high reward. A badly handled Athlete or Creator crisis costs the relationship, your position and the coda, never debut itself (exact costs tbd in #429, #430).

**Epilogue structure (post-debut):** three shared layers, no per-origin epilogue routes.

1. Debut result: debuted or not, from evaluations and the crisis gate.
2. Relationship ending: Haeun's Opened, Armored or Stuck (Jin's endings on his route).
3. Origin coda (table above), plus the origin's earned epilogue scene: Yerin still in the group (Athlete), the Grandma video (Creator), the restaurant opening (International-School Kid).

TBD: what a not-debuted epilogue shows, so it reads as a life, not a consolation.

## Data model and production scope

Origins are a thin layer over existing systems: relationship state, bids, `knows{}` flags, the calendar and route endings.

**State additions:**

- `origin`: `athlete` | `creator` | `intl_kid`; homeLanguage set at character creation, separate from nationality.
- One generic hidden counter, `toll`, read per origin as strain, exposure or debt: same field, different consequences. Like Jin's directive counter, it is never shown; tells show it.
- Earned powers use the existing per-character trust, no new scores: trust with the trainees (Athlete), with Haeun's mum (Creator), with your parents (International-School Kid). Haeun's mum and your parents are added as characters in the relationship state.
- Flags for signature outcomes, e.g. `grandma_video_sent`, `yerin_saved`, `restaurant_opened`, `ankle_choice`.

**Exclusive options:** an option carries `requires: { origin, ... }` plus effects on counters and flags, shown in UI with an origin tag such as **[Creator]**.

**Content budget:**

| Item | Count |
| --- | --- |
| Everyday perks and weekly loops (one each) | 3 |
| Crisis scenes (with mastery tiers) | 3 |
| Signature moments | 3 |
| Unique-fate scene chains | 3 |
| Funeral messenger scenes | 3 + Sua fallback |
| Vantage scenes on shared beats | ~12 |
| Endings codas | 9 |

The funeral, evaluations and route endings stay shared.

## Open questions and canon changes (from the PRD)

**Canon changes this PRD needs (not yet in the repo):**

- [ ] Add Grandma's death and the funeral to the calendar at month 11, with the family hiding it from Haeun.
- [ ] Add a default event around month 8: Yerin overtrains, gets injured and is cut, unless the Athlete intervenes.
- [ ] Add Haeun's mum and the player's parents as characters in the relationship state.
- [ ] TBC: extend the bid rules with the reciprocity behaviour (Haeun pays back in small ways).
- [ ] Add origin-specific roles to Coach Park and Manager Choi.

**Open questions:**

- [ ] Three "someone disappears from a lineup" beats (Sua, Seo-yeon, hard mode) risk feeling repetitive. Is hard mode the conscious payoff?
- [ ] Does the Creator's existing audience persist into Shanghai, and do Chinese variety shows treat it as an asset?
- [ ] Which origins can reach Tokyo, and for what reason (the jiko bukken apartment hunt is shared)?
- [ ] Which sport is the Athlete? Candidates: artistic swimming, breaking, rhythmic gymnastics, figure skating.

## Where this meets canon

Points found when checking the PRD against `canon/*.ts`, `seoul-evals.md` and `seoul-evals-tbc.md` (2026-11-01). None is decided; each needs an owner call before it is built.

1. **Decided 2026-11-01, added to `haeun.ts`.** Haeun's mum's restaurant is new canon. `haeun.ts` says her mother "works in Jeju-si" and Haeun sends money home. A restaurant dream (in Seoul) has to be added to her family background.
2. **Two cuts.** The dorm direction (T17) uses a cut at eval 6 to open a bed; the PRD adds a default month-8 Yerin cut. Both can stand, but T2 (who is cut at eval 6) now has to account for both, and the Athlete's "nobody is cut" fate has to say whether it also prevents the eval 6 cut.
3. **Decided 2026-11-01: only the International-School Kid can be locked out of debut; `world.ts` rule updated.** Debut lockout vs "the player is never cut". `world.ts`: "A bad eval means probation, not a wall." The PRD's crisis gates lock you out of debut whatever your scores. Not a contradiction (scores still never wall you), but the rule should name the crisis gate as the one exception.
4. **Yerin's role.** The cohort handoff makes Yerin quietly the best vocalist; the PRD makes her the overtrainer who gets cut. Compatible, but her canon entry should carry both.
5. **Where the Sunday calls happen.** Haeun's is canon on the dorm rooftop (her "place to be nobody"). Putting the International-School Kid's call on the same rooftop the same evening is a new shared scene, not a clash, but it touches her private place.
6. **The dorm.** The PRD's "no separate living arrangement" matches the dorm decision (girls' dorm, separate buildings by gender). The International-School Kid's officetel is daytime only.
7. **Origin selection UI is out of scope,** but `homeLanguage` is set at character creation; the cozy creator already asks nationality and birthday (#424), so it is the natural place to add both.
