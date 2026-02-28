# Deployment Track (Parallel And Swappable)

## Goal
Keep deployment independent from demo implementation so the same client can run:
1. entirely local mock,
2. local server,
3. remote server.

## Frontend hosting
1. Fastest path: Vercel for Next.js web build.
2. Parallel path: Cloudflare Pages/Workers using equivalent client build output.

## Backend hosting
1. Local: run in development for integration testing.
2. Remote option A: Cloudflare Workers stack.
3. Remote option B: any Node-hosted API platform.

## Swap contract
The client must never directly depend on host-specific behavior.
Only these env keys can change:
1. `TONG_BACKEND_MODE`
2. `TONG_LOCAL_API_BASE_URL`
3. `TONG_REMOTE_API_BASE_URL`

## Demo safety rule
If remote host fails, switch to `local-mock` and continue the same run-of-show.
