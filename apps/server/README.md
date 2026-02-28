# apps/server

Server-side features isolated from client iteration.

Current ingestion responsibilities:
1. Enriched captions endpoint.
2. Dictionary entry endpoint.
3. 72-hour YouTube + Spotify transcript/lyrics ingestion and frequency ranking.
4. Topic clustering for planner signals.
5. Planner-context output for lesson/scene/exercise generation.
6. Profile persistence and game session bootstrap.

Implementation rule:
- Match payloads in `packages/contracts` exactly.

Planner context generation (from fixture events):
```bash
npm run ingestion:planner
```

Regenerate planner context fixture:
```bash
npm run ingestion:planner:fixture
```

Vocab frequency generation:
```bash
npm run ingestion:vocab:frequency
```

Regenerate vocab frequency fixture:
```bash
npm run ingestion:vocab:frequency:fixture
```

Vocab insights generation:
```bash
npm run ingestion:vocab:insights
```

Regenerate vocab insights fixture:
```bash
npm run ingestion:vocab:insights:fixture
```

Core scripts:
- `apps/server/ingestion/pipeline.mjs`
- `apps/server/ingestion/generate_planner_context.mjs`
- `apps/server/ingestion/generate_vocab_frequency.mjs`
- `apps/server/ingestion/generate_vocab_insights.mjs`
