# Integration Notes

Use this file for short, current coordination notes only.
Keep entries focused on active integration risks instead of dated work logs.

Template:
- Area:
- Scope:
- Contract touch points:
- Integration risks:
- Next owner:

Current note:
- Area: Shanghai onboarding and webtoon runtime
- Scope: Scene rendering, onboarding flow, and adjacent shared contracts
- Contract touch points: `packages/contracts/**`, `apps/client/app/globals.css`, `apps/client/components/scene/**`, `apps/client/lib/content/shanghai/**`
- Integration risks: shared scene files and contract fixtures can drift if edited in parallel
- Next owner: whoever takes the next cross-stream integration pass
