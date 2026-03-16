# CLAUDE.md — tong

## Branch & Worktree Safety

Multiple Claude Code sessions may run concurrently on this repo. To avoid conflicts:

1. **Check your branch before editing**: Run `git branch --show-current` at session start. Confirm you're on the correct feature branch — not `main` and not another session's branch.
2. **Use worktrees for parallel work**: If another session is active on a branch, create a worktree (`/worktree`) instead of switching branches in the main checkout.
3. **Never force-push or reset shared branches** without explicit user approval.
4. **Dev server ports**: Main repo uses port 3000. Worktrees must use different ports (3001, 3002, etc.). Before starting a dev server, check for existing Next.js processes: `ps aux | grep next`.

## Project Structure

- Monorepo: `apps/client/` is the Next.js 14 (App Router) game client
- Game entry: `apps/client/app/game/page.tsx`
- Game store: `apps/client/lib/store/game-store.ts` (singleton with localStorage persistence)
- Components: `apps/client/components/` (scene/, city-map/, learn/)
- CSS: `apps/client/app/globals.css` (plain CSS, no Tailwind utility classes in components)

## Dev Commands

```bash
cd apps/client
npx next dev -p 3001   # dev server (pick unused port)
npx tsc --noEmit        # type check
```

## Conventions

- Plain CSS classes in `globals.css`, not Tailwind utilities
- Functional components with hooks, no class components
- `useChat` from `ai/react` for AI streaming
- Game state via singleton store (`dispatch` / `useGameState`), persisted to localStorage
- All external API integrations should be structured as callable tools for AI
