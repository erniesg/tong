# Shanghai H1 — Generation Prompts

Fixture: `shanghai/h1-negotiation`
Scene: 小笼包店 lunch — player overhears 丁漫 + 守成 negotiating; 守成 leaves first; 方阿姨 reveals 瞿家的小儿子 backstory in webtoon cliffhanger.

Purpose: paste-ready prompts for every asset the prebaked H1 needs — character sheets, location, backdrop, three webtoon panels, and the dialogue generation prompt (for dynamic mode).

---

## 1. Art direction principles

### Style
- Hand-painted webtoon illustration. Soft lineart over painted color. Chinese indie comic aesthetic (think 老上海 grounded realism, not anime/manga).
- Visible brushwork in backgrounds; cleaner strokes on characters.
- Neither photo-realistic nor stylized-cute. Mid-point that feels human.

### Palette (locked)
- **Interior:** warm yellows, soft browns, paper-bag tans, occasional red from chili oil bottle
- **Exterior through glass:** cool afternoon blue-grey, washed pastel
- **守成:** navy blazer + white tee + warm gold glasses (cool/warm split)
- **丁漫:** khaki workwear + white tee + black hair (neutral earth palette, de-glamorized)
- **方阿姨:** small-floral blouse + dark blue apron (homey, working)
- Thread: the warm interior is home; the cool outside is elsewhere — 守成 crosses that threshold when he leaves.

### Spatial consistency rules (READ EVERY TIME YOU GENERATE)
1. Use **identical character description tokens** across all prompts. Copy-paste, don't paraphrase.
2. Use **identical location tokens**.
3. Use **identical style, lighting, time-of-day tokens**.
4. Generate all panels of a sequence in **one session** where possible. Lock seed if your tool supports it.
5. Where the tool supports reference images: generate character ref sheets first, feed them as references to all subsequent prompts.
6. If a detail isn't specified in the reference, **leave it vague rather than invent**. Invention = drift.
7. Panel 1→2→3 must read as the **same afternoon in the same shop** — same chair positions, same light direction, same steamer on the table.

---

## 2. Character reference sheets

### 守成 (Qú Shǒuchéng) — 24, male, investor

**Physical (locked tokens):**
```
24-year-old Chinese male, 181cm tall, lean thin build
Face: long oval with clean lines, sharp jawline
Brows: sword-shaped, dark, even and well-groomed (剑眉浓黑整齐)
Eyes: inner-fold lids close to monolid (内双近单眼皮), pure black irises, faint eyebags from sleep deprivation
Nose: straight, high bridge, slightly pointed tip (挺拔高鼻梁鼻尖微尖)
Lips: thin (薄唇)
Skin: cool-toned fair (冷白皮)
Hair: black, short, side-parted, neatly combed
```

**H1 outfit (locked):**
```
Thin gold wire-frame glasses (金色细边眼镜)
Deep navy blazer (深海军蓝西装外套), sleeves rolled to mid-forearm
Plain white cotton crew-neck tee underneath (白色纯棉圆领T恤)
Dark fitted trousers (深色合身西裤)
No watch visible, no rings, no other accessories
```

**Body language in H1:**
- Sits straight, forward lean when engaged, elbows on table when making a point
- Hands interlaced or holding a pen; rarely touches food
- Face neutral → slightly tight at moments of challenge
- No smiles in H1

---

### 丁漫 (Dīng Màn) — 28, female, former actress / mentor

**Physical (locked tokens):**
```
28-year-old Chinese female, 168cm tall, slim build
Face: oval with high cheekbones (高颧骨鹅蛋脸)
Brows: naturally thick, unplucked (自然野生浓眉)
Eyes: peach-blossom shape with slight inner fold (桃花眼微内双), deep brown-black irises
Skin: cool ivory (冷调象牙白), natural freckles scattered across nose bridge and upper cheeks (天生雀斑)
Nose: straight, high bridge (挺直高鼻梁)
Lips: thin upper, fuller lower (上薄下厚唇)
Hair: long, black
```

**H1 outfit (locked — de-glamorized, off-duty):**
```
Hair up in a black shark hair clip (鲨鱼夹), with some loose wispy strands framing face
Oversized khaki workwear shirt (宽松卡其色工装衬衫), boxy cut
Plain white tee underneath (白色内搭T恤)
Straight-cut dark jeans (深色直筒牛仔裤)
Woven cord bracelet on right wrist (编织绳手链)
Faint paint traces on fingernails (指甲残留颜料痕迹) — barely visible
No makeup, no jewelry otherwise
```

**Body language in H1:**
- Relaxed posture, slow deliberate chewing
- Eyes mostly on her food, glances up only when needed
- Uses chopsticks cleanly
- Never checks phone
- One singular pause of chewing mid-scene (b2e) — otherwise steady

---

### 方阿姨 (Fāng Āyí) — mid-50s, shop owner

**Physical (locked tokens):**
```
Mid-50s Chinese Shanghainese female, around 158cm, stocky but energetic
Hair: mid-length, mostly black with visible grey streaks, pulled back in a low bun
Face: weathered with deep laugh lines, faint vertical frown line between brows
Eyes: sharp, observant, dark brown
Hands: working hands — small nicks, practical, fast
```

**H1 outfit (locked):**
```
Small-floral print short-sleeve cotton blouse (碎花短袖棉衫)
Dark blue full apron, slightly stained, well-used (深蓝色围裙)
Black loose trousers (黑色宽松长裤)
Plastic kitchen slippers
Cloth handkerchief tucked into apron pocket (布手帕)
```

**Body language in H1:**
- Always in motion — wiping, clearing, refilling
- Sharp eyes, notices everything
- Familiar with both 丁漫 and 守成; diminutives 小瞿 / 小丁 reveal history

---

## 3. Location reference: 小笼包店 interior

**Locked tokens:**
```
Small neighborhood Shanghai 小笼包店 (soup dumpling shop).
Not touristy — lived-in, working-class, 老上海 feel.

Interior:
- Six small wooden tables with red plastic stools
- Counter at back with stacked bamboo steamers, visible steam rising
- Partial view into kitchen through open pass-through; cook in white clothes
- Tile floor, slightly worn
- Yellow-painted walls with minor grease shadows near kitchen area
- Fluorescent tube lights overhead + afternoon sun through front glass
- Menu painted in red characters on yellow panels mounted on the wall
- Corner table near the front window = where 丁漫/守成 sit
- Each table has: chili oil cruet, dark vinegar bottle, metal paper-napkin holder, small jar of white pepper, chopstick holder

Time of day:
- Mid-afternoon lull, approximately 2:30 PM
- Shop quiet, only 2-3 other customers visible at other tables
- Warm yellow interior light contrasts cool blue afternoon street visible through the glass door

Mood:
- Lived-in, unpretentious, everyday
- 烟火气 — wok smoke from kitchen, steam from steamers
- Not Instagram-clean, not chain-branded
```

**Negative (always exclude):**
```
no modern chain branding, no Western decor, no stylized anime eyes, no photorealistic render, no clean minimalism, no tourist signage, no English text
```

---

## 4. Backdrop: H1 in-scene VN view

Used as the static SceneView backdrop during beats 1–2 (before webtoon takes over).

**Prompt:**
```
[STYLE] Hand-painted webtoon illustration, soft lineart, warm muted palette, Chinese indie comic aesthetic, visible brushwork in background, cleaner lines on characters

[LOCATION] Small neighborhood Shanghai 小笼包店 interior, mid-afternoon. Warm yellow fluorescent light, cool afternoon blue through front glass door visible at frame edge. Wooden tables with red plastic stools. Bamboo steamers stacked at back counter with visible steam. Yellow-painted walls with subtle grease shadows. Tile floor slightly worn. Menu painted in red characters on yellow panels.

[FRAMING] Medium-wide interior shot. The corner table near the front window dominates the lower half of the frame. Two steamers on the table (one untouched, one half-empty), a small vinegar dish, chili oil cruet, chopstick holder. Two chairs, both occupied. The rest of the shop visible in soft focus behind — a few other customers at other tables, kitchen pass-through visible in the background with cook moving.

[CHARACTERS]
- Left chair: 瞿守成 — 24-year-old Chinese male, 181cm lean thin build, long oval face with sharp jawline, sword brows dark and even, inner-fold lidded eyes with pure black irises, straight high-bridge nose, thin lips, cool-toned fair skin, black short side-parted hair, thin gold wire-frame glasses, deep navy blazer with sleeves rolled to mid-forearm, white crew-neck tee underneath, dark fitted trousers. He is leaning forward slightly, elbows on the table, hands interlaced. His steamer is barely touched. His eyes are on the person across from him, reading reactions.

- Right chair: 丁漫 — 28-year-old Chinese female, 168cm slim, oval face with high cheekbones, natural thick unplucked brows, peach-blossom inner-fold eyes deep brown-black, cool ivory skin with natural freckles across nose and upper cheeks, straight high-bridge nose, thin upper and fuller lower lips, long black hair up in a black shark hair clip with wispy strands, oversized khaki workwear shirt over plain white tee, straight dark jeans, woven cord bracelet on right wrist. She is eating, unhurried, chopsticks mid-motion.

[CAMERA] Medium wide shot, camera at eye level from across the aisle, slight angle so both characters are visible in 3/4 profile. Focus on the table and both characters equally.

[MOOD] quiet negotiation, afternoon lull, one is pitching and one is eating, power asymmetry visible in body language

[LIGHTING] Warm interior yellow fluorescent overhead + soft afternoon light from the left window. Cool blue outside visible through glass. Contrast at the threshold.

[ASPECT RATIO] 16:9 landscape for VN scene view (backdrop fills phone landscape or is letterboxed in portrait)

[NEGATIVE] no text, no logos, no modern chain branding, no Western decor, no anime stylization, no photorealistic render, no clean minimalism, no overt glamour
```

---

## 5. Webtoon panel sequence — cliffhanger (post-exit, 3 panels)

### Sequence layout spec

| Panel | Width type | Height class | Aspect ratio | Shot | Gap before | Thumb-stop? |
|---|---|---|---|---|---|---|
| 1 | Full-width | Tall | 2:3 (800×1200) | Wide establishing | Normal (120px) | No |
| 2 | Full-width | Standard | 1:1 (800×800) | Medium OTS | Normal (120px) | No |
| 3 | **Full-bleed** | **Tall** | **4:7 (800×1400)** | **Extreme close-up** | **Wide (300px, black)** | **YES** |

**Pacing logic:**
- Panel 1 is the exhale — reader scrolls through the departure
- Panel 2 is the bridge — brief, observational
- Panel 3 is the thumb-stop — wide black gap before forces a pause, then the reveal lands

**Transitions (for game UI renderer):**
- P1 → P2: cut transition, 300ms
- P2 → P3: darken transition over 800ms, hold on black for 400ms, then fade in P3
- Speech bubble on P3 appears with 200ms delay after panel is visible

**Credit gate:** appears after P3 is fully displayed, with bubble showing the partial line `瞿家的小儿子……`

---

### Panel 1 — Establishing / Exhale

**Narrative function:** 守成 has just left. This is the reader's exhale. Works from both POVs because the reader is positioned behind both characters looking toward the door.

**Prompt:**
```
[STYLE] Hand-painted webtoon illustration, soft lineart, warm muted palette, Chinese indie comic aesthetic, consistent with established scene

[LOCATION] Inside small neighborhood Shanghai 小笼包店, looking from the back of the shop toward the front glass door. Warm yellow fluorescent interior light. Afternoon sunlight cool blue through the glass door.

[COMPOSITION] Tall portrait frame.
- Lower third of frame: interior of shop visible — one corner table on the right with 丁漫 seated from the side, soft focus, she is calmly eating 小笼包 with chopsticks, half-empty steamer in front of her, oversized khaki workwear shirt, shark hair clip in black hair
- Middle and upper two-thirds: the front glass door, just closed or in the act of closing. Through the glass: silhouette of a tall thin young man in a dark navy blazer walking away to the left down the afternoon street. He is back-to-camera, only silhouette visible against cool afternoon light.
- A few other tables visible in the mid-ground, out of focus, with unrelated customers

[CHARACTERS]
- 丁漫 (foreground right, soft focus): 28-year-old Chinese female, hair up in black shark clip with wispy strands, oversized khaki workwear shirt over plain white tee, seated from side angle, chopsticks in hand, eating slowly
- 守成 (through glass, silhouette only): tall thin silhouette, dark navy blazer, walking away, back to camera. No facial detail visible.

[CAMERA] Wide establishing shot. Camera at eye level, from the back of the shop toward the door. Slight leftward tilt.

[MOOD] Quiet closure, an exhale, the scene has ended but something unresolved lingers in the air.

[LIGHTING] Warm yellow interior glow, cool blue afternoon light outside, visible contrast at the glass threshold.

[ASPECT RATIO] 2:3 tall portrait (800×1200)

[NEGATIVE] no text, no signs, no anime stylization, no overly saturated colors, no clean minimalism, no photorealistic render
```

---

### Panel 2 — Observational Bridge

**Narrative function:** 方阿姨 enters frame to clear the barely-touched steamer. Transitional, observational. Sets up the reveal.

**Prompt:**
```
[STYLE] Hand-painted webtoon illustration, soft lineart, warm muted palette, consistent with Panel 1

[LOCATION] Same small neighborhood Shanghai 小笼包店, corner table near the front window. Same mid-afternoon warm interior light.

[COMPOSITION] Square frame (1:1).
- Left foreground (soft focus): 丁漫's upper back and hair clip from behind, still seated and facing her own food
- Center and right sharp focus: 方阿姨, mid-50s Shanghai auntie in small-floral short-sleeve blouse with dark blue apron, standing beside the table. A cloth in her left hand. Her right hand is reaching toward a bamboo steamer that is still mostly full (small dumplings visible inside)
- Her face in 3/4 profile, mouth closed in a small frown
- On the wooden table: the mostly-full steamer, a small vinegar dish, folded bills visibly too many for one meal

[CHARACTERS]
- 丁漫 (soft focus left foreground): back view, shark hair clip, khaki workwear shirt
- 方阿姨: mid-50s Chinese Shanghainese female, around 158cm, stocky, weathered face with deep laugh lines and faint vertical frown line between brows, mid-length hair mostly black with grey streaks pulled back in a low bun, small-floral print short-sleeve cotton blouse, dark blue full apron slightly stained, black loose trousers, currently with a small frown at the corner of her mouth

[CAMERA] Medium shot. Camera slightly above standing height, looking slightly down toward the table. Over 丁漫's shoulder from behind.

[MOOD] Observational, transitional, slight disapproval or knowing, the 阿姨 has seen this pattern before

[LIGHTING] Warm interior yellow, softer than Panel 1, the table is the central pool of light

[ASPECT RATIO] 1:1 square (800×800)

[NEGATIVE] no text in image, no dialogue bubble in image, no modern branding, no overt drama
```

---

### Panel 3 — Extreme Close-up / Thumb-stop

**Narrative function:** The reveal. 方阿姨 mutters 瞿家的小儿子. This is the moment. Speech bubble overlays the lower portion of the frame.

**Prompt (image only, bubble added in compositor):**
```
[STYLE] Hand-painted webtoon illustration, soft lineart, warm muted palette, focused detail on face texture, same style as Panels 1 and 2

[LOCATION] Inside same 小笼包店, same corner table area

[COMPOSITION] Very tall portrait frame (4:7).
- Subject fills the upper 60% of the frame: extreme close-up on 方阿姨's lower face from mouth to chin and up to just below jawline. 3/4 profile view from camera-right. Her lips are slightly parted, forming words mid-syllable. Fine wrinkles around the mouth visible. Slight frown at the corner of her mouth
- Background upper area: heavy soft-focus blur. Just enough to suggest 丁漫's silhouette from behind — her hair clip, upper shoulder line, blur of khaki shirt. Not distracting
- Lower 40% of frame: empty warm-tinted space with soft gradient. Leave this area clean for a speech bubble overlay (added by the compositor, not in the image itself)

[CHARACTERS]
- 方阿姨 (subject): mouth, jaw, lower cheek area only. Weathered skin with fine wrinkles, natural color, slight frown tension at the corner of her mouth. Lips parted mid-word. No eyes, no nose, no full face.
- 丁漫 (background blur): silhouette only — shark hair clip, shoulder line, khaki shirt blur. No face detail.

[CAMERA] Extreme close-up, tight crop, 3/4 profile from camera-right.

[MOOD] Quiet revelation, intimate, the viewer is close enough to hear her breath. Something is about to be said that the speakers in the scene are not supposed to hear.

[LIGHTING] Warm yellow interior dimming to softer shadow near frame edges. One subtle catchlight on her lower lip. The upper-left area (behind 丁漫) is darker than the mouth.

[ASPECT RATIO] 4:7 very tall portrait (800×1400)

[NEGATIVE] no full face, no eyes visible, no teeth, no sharp focus on 丁漫 or anything behind, no background text, no pre-rendered speech bubble (bubble is overlay), no clutter in lower 40% of frame
```

**Speech bubble overlay spec (rendered by compositor):**
```
Position: center-bottom, within lower 40% empty area of Panel 3
Shape: soft rounded rectangle, warm off-white fill (#FFF8EE), soft drop shadow
Tail: pointing up-right toward 方阿姨's mouth
Text:
  Primary: 瞿家的小儿子…… (in clean handwritten-feel Chinese font, size ~36px at 800px canvas)
  Tag: subtle "方阿姨" label above bubble OR integrated into tail
Animation on reveal: 200ms fade-in + 100ms settle after panel appears
Pinyin tooltip (on tap): Qú jiā de xiǎo érzi
Translation tooltip: "The Qu family's younger son..."
```

---

## 6. Dialogue generation prompt (dynamic mode)

Used when running H1 in dynamic mode. The fixture is injected as `<fixture>` context; the prompt enforces beat order, locked lines, and voice rules.

**File (intended destination):** `apps/client/lib/ai/prompts/shanghai-onboarding-h1.ts`

**Prompt body:**
```
You are orchestrating H1 of the Shanghai onboarding hangout: the player has walked into a small neighborhood 小笼包店 for lunch and is unintentionally witnessing a negotiation between two strangers at the corner table.

This is an EAVESDROP scene. The player is an observer. NPCs do NOT address the player. Tong translates and teaches; the player learns by listening. Never emit offer_choices — player agency is in credit-spend decisions only.

══ SCENE FIXTURE ══
You execute the fixture shanghai/h1-negotiation. Fixture beats (injected as <fixture>) define speaker, intent, locked lines, variant examples, and per-beat style rules. You MUST emit beats in order. Do not skip, reorder, or add beats.

LOCKED LINES: use verbatim unless the beat explicitly permits variation. Some beats offer PAIR GROUPS (primary pair vs alternate pair). Pick ONE pair at scene start and stay in it — do not mix across pairs mid-scene.

VARIANTS: only allowed when the beat is marked variable. Variant examples exist to prime your style — treat as reference, don't copy.

STYLE RULES per beat: hard constraints. Violating them = regenerate the beat.

══ VOICE RULES (always in force, even on locked lines) ══

瞿守成 — forbidden moves (any violation = regenerate):
- Never append meta-tags to his own distinctions. Banned tokens: 不一样的, 就是这样, 你懂的, 明白吧, 对吧.
- Never explain his own insight. State it. Stop.
- Never echo his OWN earlier words. He only echoes HER words.
- Never reference history the player hasn't witnessed (prior meetings, prior productions, prior deals).
- No flattery, no softeners, no "sorry", no throat-clearing.
Style: short declarative. Rehearsed pitch register in b2a. Recalibrating register after concession in b2c. Flat life-delivery on the phone (ex5).

丁漫 — patterns:
- Minimum viable response in b1b, b1c's reply, exit beats — unless the beat explicitly allows longer.
- Never acknowledge his business framing head-on. Redirect or mirror.
- Never reference her past (fame, scandal, mentor role). H1 has not earned it.
- Food-as-deflection. She does not stop eating except at the one marked moment (b2e).

方阿姨 — the chorus:
- The only character who speaks TO the player (via Tong context or directly in the cliffhanger credit-gate reveal).
- Uses diminutives 小瞿 / 小丁 — these encode her history with them.
- Scolding-but-familiar when addressing 守成. Observational when the audience is the player.

══ TONG (teaching overlay) ══
- Emits via tong_whisper tool.
- Teaches at beat transitions only — never mid-dialogue.
- Free tong beats fire regardless of credits. Gated beats fire after credit spend.
- Maximum 2 sentences per whisper. Characters + pinyin + meaning + why-it-matters.
- Never bare romanization — write 方案 not "fang'an". Pinyin annotation inside parentheses is fine.

══ TOOL MAPPING ══
Per beat:
- speaker ∈ {dingman, shoucheng, ayi} → emit npc_speak(characterId, text, translation, expression, affinityDelta=0, clarity="full"|"fragment")
- speaker = "ambient" → emit set_atmosphere(description)
- Cliffhanger panels → emit show_webtoon({ panels, autoAdvance: false })
- tongInterjection → emit tong_whisper BEFORE beat if trigger="before", AFTER if trigger="after"
- exerciseHook → emit show_exercise AFTER the tong beat of the parent beat
- creditGate → emit credit_gate(cost, spendPayload, skipPayload)

Clarity semantics: player is HSK 0. Beats with clarity="fragment" render Chinese only with character-level UI fragments — player relies on Tong. Default clarity for this scene = "fragment" except 方阿姨's direct-to-player lines (clarity="full" after credit spend).

After all beats → emit end_scene with masteryUpdates (at least: 方案, 愿意 or 装, 不一样), affinityChanges (fangayi +3), stateUpdates (hangoutSeat = resolved facing).

══ POV SEAT ══
At scene start: randomly pick facing ∈ {shoucheng, dingman}. Emit set_backdrop with povVariants[facing].seatDescription. Store facing in scene state as hangoutSeat — this is read by H2 to branch.

The facing choice does NOT alter dialogue content — both characters' lines are heard from either seat (one across, one from behind). It only changes the opening visual description and subtle blocking cues (who is "behind" the player, who is "across").

══ INPUT ══
<fixture>{{fixtureJson}}</fixture>
<player>{ level: 0, calibratedLevel: null, mastery: {} }</player>

══ OUTPUT ══
Emit tool calls in beat order. No narrative prose outside tool calls. Exposition only inside tong_whisper. Character speech only via npc_speak.

Begin with set_backdrop (povVariants[facing].seatDescription), then opening tong_whisper (the "two people, one's eating" line), then beat b1a.
```

---

## 7. Quick-reference (paste-ready image prompts)

### Backdrop (VN scene view)
[See section 4 above — full block ready to paste into 即梦 / midjourney / your tool of choice]

### Panel 1
[See section 5.1]

### Panel 2
[See section 5.2]

### Panel 3
[See section 5.3]

### Speech bubble overlay for Panel 3
Rendered by compositor — not an image gen task. See section 5.3 for spec.

---

## 8. Iteration notes

- **If characters drift across panels:** regenerate with character ref image fed in, or use the locked-token block verbatim and check that no synonyms were introduced.
- **If style drifts:** lock a single panel you like, use it as reference for the others. The hand-painted webtoon aesthetic is the load-bearing consistency.
- **If the 方阿姨 looks too young/sharp:** increase weight on "weathered", "deep laugh lines", "grey streaks", "mid-50s", and reduce any anime-adjacent facial geometry.
- **If the mood goes too dramatic:** pull back lighting contrast. This is mid-afternoon in a working-class shop, not a film noir interrogation.
- **If 丁漫 looks glamorous:** remove any styling/makeup implication. The whole point is she's off-duty. Shark clip, no makeup, fingernail paint traces.
- **Panel 3 common failure mode:** generator tries to render the full face instead of extreme close-up on mouth. Add "bottom half of face only", "eyes not visible", "crop above nose excluded" to negative prompt.
