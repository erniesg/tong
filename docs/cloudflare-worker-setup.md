# Cloudflare Worker Setup (Parallel Local + Cloud)

## Goal
Run Tong APIs both locally and on a Cloudflare Worker so you can switch instantly during demos.

## 1) Create/Connect Cloudflare account
1. Create account at `https://dash.cloudflare.com/sign-up`.
2. Install Wrangler (already in repo worker package):
```bash
npm --prefix apps/worker install
```
3. Login from CLI:
```bash
npx wrangler login
```
4. Verify:
```bash
npx wrangler whoami
```

## 2) Deploy API worker
From repo root:
```bash
npm run deploy:worker
```

Wrangler returns a URL like:
`https://tong-api.<subdomain>.workers.dev`

## 3) Run local + cloud in parallel
Terminal 1 (local node API):
```bash
npm run dev:server
```

Terminal 2 (local worker API):
```bash
npm run dev:worker
```

Terminal 3 (client):
```bash
npm run dev:client
```

## 4) Switch client between backends
Use `apps/client/.env.local` and set one variable:

### Local Node API
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
```

### Cloud Worker API
```bash
NEXT_PUBLIC_API_BASE_URL=https://tong-api.<subdomain>.workers.dev
```

Restart `npm run dev:client` after changing env.

## 5) Quick endpoint checks
```bash
curl "http://localhost:8787/health"
curl "http://localhost:8788/health"
curl "https://tong-api.<subdomain>.workers.dev/health"
```

```bash
curl "https://tong-api.<subdomain>.workers.dev/api/v1/objectives/next?userId=demo-user-1&mode=hangout&lang=ko"
```

## Notes
- Worker state is in-memory (demo-friendly), so profile/session state can reset between isolates.
- Keep local Node API available as fallback (`NEXT_PUBLIC_TONG_BACKEND_MODE=local-server`).
- Optional legacy fallback vars are still supported:
  - `NEXT_PUBLIC_TONG_BACKEND_MODE`
  - `NEXT_PUBLIC_TONG_LOCAL_API_BASE_URL`
  - `NEXT_PUBLIC_TONG_REMOTE_API_BASE_URL`
