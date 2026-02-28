# apps/client

Next.js review app for Tong hackathon demo surfaces.

## Run

```bash
npm --prefix apps/client install
npm --prefix apps/client run dev
```

Set API base (optional):

```bash
NEXT_PUBLIC_TONG_API_BASE=http://localhost:8787
```

## Routes

- `/` launcher for demo surfaces
- `/overlay` web caption overlay + dictionary popover
- `/game` mobile-first game UI (start/resume, hangout, learn)
- `/insights` ingestion controls + frequency/topic visualization
