# Vocabulary Modeling And Clustering (Technical Approach)

## Recommendation
Use a hybrid pipeline:
1. Frequency + burst detection for salience.
2. Embedding-based clustering for semantic topics.
3. Rule-based orthography decomposition (radical/jamo/morpheme families).
4. Objective-gap scoring to prioritize what to teach next.

This gives technical depth while staying hackathon-feasible.

## Data pipeline
1. Collect transcript/lyrics lines from the last 72 hours per user.
2. Normalize text by language (NFKC, punctuation cleanup, dedupe repeated chorus lines).
3. Segment/tokenize by language:
- Korean: morpheme tokenizer + lemma normalization.
- Japanese: MeCab-style segmentation + lemma.
- Chinese: word segmentation + character decomposition.
4. Attach metadata per token:
- source type (`youtube` or `spotify`)
- timestamp
- media id
- language confidence

## Scoring model
For each term, compute:
1. `frequency`: count in 72h window.
2. `burst`: recent-rate / baseline-rate.
3. `relevance`: weighted by source recency and watch/listen duration.
4. `objectiveGap`: how much this term aligns with unmet objectives.
5. `masteryPenalty`: lower score if user already mastered.

Priority score example:
`score = 0.30*frequencyNorm + 0.25*burstNorm + 0.20*relevance + 0.15*objectiveGap + 0.10*novelty`

## Topic clustering
1. Create multilingual sentence/term embeddings.
2. Cluster terms with HDBSCAN (good for unknown cluster count).
3. Label clusters with c-TF-IDF top keywords.
4. Keep fallback: if cluster quality is low, group by location/domain rules.

## Orthography focus layer
1. Han script: detect radical family (e.g., `火`) and related characters.
2. Hangul: detect reusable syllable/jamo patterns.
3. Japanese: separate kana terms from kanji-family terms.

Output examples:
1. "Fire family" focus card (`火`, `炎`, `烧`).
2. "Food ordering" phrase family (`주문`, `주세요`, `메뉴`).

## Learning objective mapping
1. Map each high-score term to:
- level target (`vocabulary`, `grammar`, `sentenceStructures`)
- location scenario (food, subway, cafe, etc.)
- mode recommendation (`hangout` vs `learn`)
2. Emit objective suggestions into `/api/v1/objectives/next`.

## UI surfaces
1. Player insight panel:
- Top clusters this week.
- Top personalized terms.
- Why this is recommended (frequency + objective gap).
2. Scene integration:
- Hangout: subtle Tong hint uses top term families.
- Learn: session starts with selected objective bundle.

## Minimum viable quality gates
1. At least 70% of top-20 terms should be semantically coherent.
2. No duplicate terms with conflicting lemmas.
3. Every surfaced term must link to at least one objective or rationale.
