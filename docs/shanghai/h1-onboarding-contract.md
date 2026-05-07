# Shanghai H1 Onboarding Contract

This contract supersedes older Shanghai H1 draft copy. Treat the old English/Tong copy as failed draft material unless this file explicitly keeps it.

## Creative Direction

Shanghai H1 is a first-person listening onboarding in a 小笼包店. The player is not learning to understand a whole conversation. They are learning to catch useful Mandarin chunks in fast, compact speech while the room keeps moving.

Tong is the companion and GM. Tong sets the room, gives one small listening handle, nudges the player toward the window-table eavesdrop, teaches from what the player has just heard, and closes with language the player can carry. Tong does not interpret motives, recap plot, predict exact lines, or explain subtext.

The NPCs are characters, not teachers. 守成 and 丁漫 should sound like people being overheard, not like tutors delivering vocabulary.

## Non-Negotiables

- Flow shape: panorama -> prelisten exercise -> pan/scroll -> continuous webtoon strip packet -> player taps to continue -> Tong/exercise -> next strip packet -> player taps to continue -> Tong/exercise -> exit strip packet -> player taps to continue -> register note -> family wording note -> player taps Step out -> return to the 小笼包店 panorama at the rightmost edge -> explicit final companion wrap -> player completes wrap -> ending screen.
- Tong speaks in the player's explain language, scaled by Mandarin level. A Mandarin beginner gets explain-language teaching with only small tappable/hearable Chinese chunks, not full Chinese helper paragraphs.
- Tong is silent during webtoon strip packets. The player scrolls to the end of the current packet and then taps a Seoul-style continue affordance before Tong or an exercise appears.
- Once the eavesdrop enters webtoon form, Tong and exercises stay over the webtoon surface until the exit/register notes are complete. Do not snap back to the panorama video or poster between packets. The only allowed return to panorama is the explicit Step out transition into Tong's final companion wrap.
- Packets append into one continuous eavesdrop strip: after an exercise resolves, the next panels continue below the completed packet.
- Interlude exercises can be minimized. If the player closes one to inspect the strip, the same webtoon stays underneath and a short continue affordance resumes the exercise.
- Chinese text inside webtoon bubbles must be tappable native-script text using the same interaction principle as Seoul.
- Chinese text inside exercises, especially matching prompts/tiles, must also use the same tappable word-help/audio convention as Seoul.
- Tong UI must use the Seoul-consistent Tong surface for interludes, not a separate subtitle card style.
- The final companion wrap is an explicit player-advanced gate before `end_scene`; handle inventory alone is not enough. It happens back in the shop panorama, not over the final webtoon panel.
- Summary/completion UI must not appear while the final companion wrap is visible. The player must complete the wrap first.
- Phone rings, QR payment, pauses, exits, and movement are panel action, SFX, or animation. They are not visible staging labels like `ambient:`.
- There are exactly two webtoon source modes:
  - `pregenerated_webtoon`: panels/bubbles are provided; Tong, exercises, pacing, and teaching choices are still dynamic.
  - `dynamic_webtoon`: panels, bubbles, actions, SFX, Tong, and exercises are generated dynamically inside this contract.
- Approved variants are content constraints, not runtime modes.

## Stocktake

Salvageable:
- The panorama + pan/scroll + webtoon eavesdrop shape.
- The existing approved art through `每个节目都说自己不一样。`, now used as the end of the first packet.
- The core anchors `小`, `小笼包店`, the four pinyin tone shapes, `想法`, `看过了`, `不一样`, `装不下去`, `小瞿`, `瞿家`, `小儿子`.
- The exit shape: phone interruption, QR overpayment, familiar address, family-register texture.

Rejected:
- Any fixed-copy assumption that treats Shanghai H1 as a line-by-line script.
- Tong explaining plot, motive, subtext, or future importance.
- Exercises that only reconstruct exact dialogue without teaching a transferable listening mechanic.
- “Hybrid” or third-mode source labels.
- Beat 2 variants that change topic illogically, especially truth/fake exchanges that do not answer the probe.
- Stale seat/facing assumptions.
- Visible admin language or staging labels in player-facing copy.

## Fixture Shape

Screen 1: Shanghai 小笼包店 panorama.

Tong:
- “Steamers at the counter. Vinegar on the tables. The sign says 小笼包店.”
- “Shanghai is already giving you Mandarin before anyone slows down for you.”
- “Stay with what the shop gives us first: one character you can see, then one sound you can hear.”
- “Start with 小. You see it in 小笼包. Later, you will hear it in a name.”
- “Watch how 小 is written. Tap 小 to hear it, then trace it in stroke order.”

Exercise:
- Current fixture starts with reusable `stroke_tracing`, but the exercise must open on a full-screen stroke-order animation before any writing canvas appears.
- Purpose: make `小` useful before the eavesdrop by making the player handle the shape and stroke order, not by introducing later register vocabulary too early.
- Current fixture trace target:
  - `小` / `xiǎo` / small
  - Stroke order: center down, left dot, right dot.
  - Player sees a replayable animation first, then taps into the writing surface.
  - Player writes `小` three times.
  - Example words must not introduce `小瞿` here. Use shop/world examples such as `小笼包` and `小吃`.
  - After completion, replay the `小` character animation and play `xiǎo` plus the player-language meaning.
- After the trace, Tong must transition organically into sound:
  - “Now listen to the tone.”
  - “Mandarin has four main tones: high, rising, dipping, falling.”
  - “小 is third tone: xiǎo. It dips low, then comes back up.”

Exercise:
- Current fixture then uses `pronunciation_select`.
- Purpose: attach sound/tone to the traced character by making the player hear the tone of `小`, not by matching pinyin prose.
- Current fixture audio choices use real Mandarin characters for the four xiao tones:
  - `消` / `xiāo`
  - `淆` / `xiáo`
  - `小` / `xiǎo`
  - `笑` / `xiào`
- Dynamic runs can choose another visible setting word, but the setup must still teach character composability with reusable `stroke_tracing`, then sound/tone with `pronunciation_select`. Use `block_crush` only after the component pieces have been explicitly prepared.

Tong:
- “Good. You have 小 in your eyes and xiǎo in your ear.”
- “The voices on the left are close enough now. Slide that way.”

Pan prompt:
- “Slide left toward the voices.”

Overhear gate:
- Reaching the pan threshold must not auto-start the webtoon. Tong must give a short cue, then the player explicitly taps to overhear.
- Example: “There. Tap to listen in.”

Strip Packet 1, pregenerated art through the first thumb stop:
- 守成: `方案你看过了。`
- 丁漫: `看了。`
- 守成: `想法？`
- 丁漫: `小笼包不错。`
- 守成: `这个节目跟其他的不一样。`
- 丁漫: `每个节目都说自己不一样。`

Tong after Packet 1:
- Teach one small cue from the strip, currently the repeated `不一样`, and transition into the exercise by saying why it helps with the next stretch of listening.
- Example: “You heard 不一样 twice. 不 is the turn: it flips 一样, ‘same,’ into ‘not the same.’” Then: “Put it back into the line once, then we keep listening.”
- Do not interpret 丁漫’s food reply as character motive.

Exercise after Packet 1:
- Current fixture: contextual fill-blank for the line pattern:
  - `这个节目跟其他的 ___ 。`
  - Correct: `不一样`
- Alternative dynamic choices can use `看过了` or `想法` only if the actual generated first packet gives those cues and the next packet makes that practice useful.

Strip Packet 2, placeholders until approved art exists:
- 守成: `那我换个说法。`
- 守成: `这个节目需要一个不装的人。`
- 丁漫: `...你觉得我不装？`
- Silent pressure panel if useful.
- 守成: `我觉得你装不下去。`

Tong after Packet 2:
- Teach the reusable form, not the plot: verb + `不下去` means an action cannot keep going.
- Example transition: “That 不下去 is the useful part. It says an action cannot keep going.” Then: “Try the shape across a few verbs so it is not trapped in one line.”

Exercise after Packet 2:
- Current fixture: `fill_blank`.
  - Prompt: “Choose the ending that means ‘cannot keep going.’”
  - Sentence: `演 ___ 。`
  - Correct: `不下去`
- Alternative generalized matching is allowed only when the layout can stay readable and the prompt does not expose grammar-code labels.
- Alternative if using the ability/willingness variant: match `不会` with “cannot,” `不愿意` with “will not,” `不会说假话` with “cannot lie,” and `不愿意说假话` with “will not lie.”

Exit Strip Packet, placeholders until art exists:
- SFX/action: phone vibrates repeatedly.
- 丁漫: `你接吧。`
- 守成: `不重要。`
- 丁漫: `都响三次了，还说不重要？`
- 守成: `...我知道了。` or `行吧。`
- 守成: `我先走一步，你好好想想。`
- Visual/action: QR payment, overpayment, leaving before resolution.
- 方阿姨: `小瞿你又多给了！`
- Final texture: `瞿家的小儿子……`

Current placeholder panel sequence:
- `p12`: phone vibration SFX/action, no `ambient:` label.
- `p13`: 丁漫 `你接吧。`
- `p14`: 守成 `不重要。`
- `p15`: 丁漫 `都响三次了，还说不重要？`
- `p16`: 守成 `...我知道了。`
- `p17`: 守成 `我先走一步，你好好想想。`
- `p18`: QR payment/overpayment visual SFX/action, no narrator text.
- `p19`: 方阿姨 `小瞿你又多给了！`
- `p20`: `瞿家的小儿子……`

Tong after Exit:
- Teach register lightly: `小瞿`, not `瞿先生`; `小 + surname` can be familiar address from an older person; `瞿家` is the Qu family.
- This register note is not the final emotional close. After the register and family wording notes, show an explicit Step out affordance, return to the shop panorama at the rightmost edge, then let Tong close from there.
- Optional depth line only if included in the run:
  - 方阿姨: `跟他爸一个脾气，犟。但是他爸犟是因为有本事。他犟是因为要证明自己也有本事。`

Wrap:
- Close as Tong walking out of the 小笼包店 with the player, not as a teacher ending class.
- The wrap must connect what the player caught in the first shop to the broader Shanghai journey.
- A phrase inventory alone is not enough, and Tong should not call the phrases “handles” in the final emotional close.
- Good direction:
  - “Take one last look before we leave the shop.”
  - “小 started on 小笼包, then came back as 小瞿.”
  - “小瞿 feels familiar. 瞿先生 would keep distance. 瞿家 makes it bigger than one person.”
  - “When 不 shows up, look for what it turns negative: 一样, 下去, 重要.”
  - “Good. That is enough to walk into the next Shanghai scene.”
- Avoid “today’s lesson,” “room,” “hangout ends here,” plot recap, or any admin/staging language.
- Only after the player completes this wrap should the same kind of hangout completion/ending screen Seoul uses for XP/SP/RP progress appear.

## Beat 2 Dynamic Variants

Beat 2 is not “Pair A or Pair B.” It is a generic beat structure:

1. 守成 offers a generic “different” pitch.
2. 丁漫 calls out that the pitch itself is generic.
3. 守成 concedes by becoming more specific or changing the wording.
4. The new wording stays on one coherent semantic axis.
5. 丁漫 probes the implication on that same axis.
6. 守成 answers on that same axis, with compression and edge.

Good calibration, act/continuation:
- 守成: `这个节目跟其他的不一样。`
- 丁漫: `每个节目都说自己不一样。`
- 守成: `那我换个说法。`
- 守成: `这个节目需要一个不装的人。`
- 丁漫: `...你觉得我不装？`
- 守成: `我觉得你装不下去。`

Good calibration, ability/willingness:
- 守成: `这个节目跟其他的不一样。`
- 丁漫: `这句话每个节目都会说。`
- 守成: `那我说具体一点。`
- 守成: `节目需要一个不会说假话的人。`
- 丁漫: `你觉得我不会？`
- 守成: `我觉得你不愿意。`

Bad logic:
- `这个节目不是那种套路。`
- `套路都说自己不是套路。`
- `好，那我换个词。`
- `它需要一个说真话的人。`
- `...你觉得我会说真话？`
- `我觉得你不会一直说假话。`

Why it fails: “换个词” promises a coherent rewording, then the scene jumps to a different semantic axis. The answer also fails to answer the probe.

## Dynamic Orchestration Prompt Requirements

The orchestration prompt must give the AI these tools:
- `show_panorama`: establish the 小笼包店 panorama and initial focus.
- `tong_whisper`: Tong only, in the Seoul-style companion voice.
- `show_exercise`: one real exercise at a time, after Tong has taught why it matters.
- `wait_for_player_pan`: require the player to pan toward the window-table eavesdrop after the first listening exercise.
- `show_webtoon_strip_packet`: a continuous scroll packet containing multiple panels and bubbles, with `completion="wait_for_player_scroll_end"`.
- `wait_for_player_continue`: a Seoul-style tap after the player reaches the strip packet end. Tong still stays silent until this tap.
- `assess_result`.
- `end_scene`.

The prompt must not offer a single-panel “show_webtoon_segment” gate as the primary unit. The primary unit is a strip packet.
The prompt must also specify that, after the first webtoon packet starts, all Tong/exercise gates keep the webtoon strip underneath and append the next packet below the existing strip. The AI must not route the player back to a panorama, poster, or video surface between eavesdrop packets.
The prompt must require a Step out transition after the exit/register notes, then a final companion wrap gate before `end_scene`. The final wrap must happen back in the 小笼包店 panorama at the rightmost edge and feel like Tong guiding the player onward through Shanghai, not closing a classroom. A phrase list by itself does not satisfy this gate, and completion/summary UI must not appear until the player explicitly completes the wrap.

The AI must choose exercises by teaching value:
- Setting sign/tone handles: `小`, `笼`, `包`, `店`
- Compact questions: `想法？`
- Already-done chunks: `看过了`, `吃过了`, `听过了`
- Same/different pieces: `不`, `一样`, `不一样`
- Negation and continuation: `不装`, `装不下去`, `演不下去`
- Ability/willingness when that variant appears: `不会`, `不愿意`, `不会说假话`, `不愿意说假话`
- Register: `小瞿`, `瞿家`, `小儿子`

Reusable Shanghai H1 exercise generation must support these objective IDs when `exerciseData` is not supplied:
- `zh-pronunciation-tone-pairs`
- `zh-script-shanghai-food-signage`
- `zh-script-shanghai-contrast-forms`
- `zh-gram-shanghai-le-aspect`
- `zh-gram-shanghai-buxiaqu`
- `zh-gram-shanghai-buhui-buyuanyi`
- `zh-gram-shanghai-ni-register`

For `pronunciation_select`, the runtime should use `hintItems` as the target chunk and generate Mandarin distractors, not Korean syllables. Audio must speak native Chinese text through `ttsText`; pinyin is display-only and must include tone marks, with neutral syllables left unmarked where natural. For `matching`, `fill_blank`, and `sentence_builder`, use reusable Mandarin patterns; exact line reconstruction is allowed only when it practices a portable pattern already taught by Tong. Matching prompts should name the form being practiced plainly, e.g. “Match each 过了 phrase with its meaning,” not vague wording like “already-done chunks.”

Tong must introduce exercises organically. A valid teaching transition has three parts: the cue the player just heard, the portable listening mechanic, and why the player is practicing it now. A bad transition is a bare grammar label followed immediately by a quiz.

The AI must avoid:
- Plot quizzes.
- Exact line reconstruction as the default.
- Glossary-bot overtranslation.
- Clever Chinese lines that explain their own subtext.
- Any dialogue where a probe and answer no longer match.
