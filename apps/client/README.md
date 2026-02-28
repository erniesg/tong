# apps/client

Next.js review app for Tong hackathon demo surfaces.

## Run

```bash
npm --prefix apps/client install
npm --prefix apps/client run dev
```

Set API base (recommended):

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
```

Cloud worker:

```bash
NEXT_PUBLIC_API_BASE_URL=https://tong-api-worker.<subdomain>.workers.dev
```

## Routes

- `/` launcher for demo surfaces
- `/overlay` web caption overlay + dictionary popover
- `/game` mobile-first game UI (start/resume, hangout, learn)
- `/insights` ingestion controls + frequency/topic visualization
