# Handoff Notes

Use this file to record cross-stream integration details.

Template:
- Date:
- Branch/worktree:
- What changed:
- Contract changes:
- Integration risks:
- Next owner:

## 2026-03-16 (Player media personalization proposal)
- Date: 2026-03-16
- Branch/worktree: `codex/server-ingestion` + `.worktrees/server-ingestion`
- What changed:
  - Added a repo-local proposal describing how YouTube/Spotify connections should feed the existing KG retrieval path instead of becoming a separate initiative.
  - Mapped current contracts and open issues so connector sync, vocab-bank derivation, and game personalization can be sequenced without colliding with issue #17 work in `client-runtime`.
  - Refined the proposal to explicitly cover segmentation/tokenization, rolling frequency counts, topic analysis, optional embedding-backed clustering, and placement scoring into lessons/hangouts/locations.
- Contract changes: none
- Integration risks:
  - Live connector auth/callback work spans `server-api` and `server-ingestion`; keep provider-specific payload handling out of `game-engine`.
  - Do not add a dedicated KG worktree unless the ownership map changes; use the existing `server-ingestion`, `server-api`, and `game-engine` lanes.
- Next owner: `codex/server-ingestion` for retrieval input modeling, then `codex/server-api` for connect/sync surface wiring
