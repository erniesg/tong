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

Core script:
- `apps/server/ingestion/pipeline.mjs`
