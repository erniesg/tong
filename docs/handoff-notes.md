# Handoff Notes

Use this file to record cross-stream integration details.

Template:
- Date:
- Branch/worktree:
- What changed:
- Contract changes:
- Integration risks:
- Next owner:

## 2026-02-28
- Date: 2026-02-28
- Branch/worktree: `master` + `.worktrees/extension-hotfix` (`codex/extension-hotfix`)
- What changed:
  - Merged PR #3 (`codex/extension-hotfix` -> `master`).
  - GitHub merge commit: `42315050c6c8e92947f56c4dc8645157a170e5cf`.
  - Updated bundling so `npm run zip` packages latest `apps/extension/**` and `assets/presets/characters/tong/**` via `scripts/build-extension-bundle.sh`.
- Contract changes: none
- Integration risks:
  - Demo should keep local dictionary API available (`localhost:8787`) for full enrichment path.
  - Avoid switching Chinese script mode mid-live demo unless cache-refresh follow-up lands.
- Next owner: `codex/client-overlay`
