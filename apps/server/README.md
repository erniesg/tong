# apps/server

Server-side features isolated from client iteration.

Initial responsibilities:
1. Enriched captions endpoint.
2. Dictionary entry endpoint.
3. 72-hour transcript/lyrics ingestion and frequency ranking.
4. Profile persistence and game session bootstrap.

Implementation rule:
- Match payloads in `packages/contracts` exactly.
