# Signals preflight/mock slice for issue #129

This document describes the narrow, cloud-portable server-side slice for `erniesg/tong#129`.

## What this slice makes portable

The following endpoints now accept an execution mode (`executionMode` or `mode`) with values:

- `preflight` — returns contract-shaped responses and explicit live dependency requirements, without running scraping.
- `mock` — returns deterministic mock-compatible response shapes for endpoint and contract validation.
- `live` — attempts real scraping and reports required external dependencies.

Endpoints:

- `POST /api/v1/signals/browser-search`
- `POST /api/v1/signals/search`
- `POST /api/v1/signals/targeted-scrape`
- `GET /api/v1/signals/browser-status`
- `GET /api/v1/signals/status`

## What remains blocked on live scraping

`live` mode still depends on third-party environments and runtime capabilities:

- outbound access to TikTok/Instagram/Xiaohongshu web surfaces,
- anti-bot behavior not blocking the runtime,
- Puppeteer + headless Chrome launch support for browser-based scraping.

A successful cloud run of the preflight/mock paths does **not** imply live scraping succeeded.

## How to test

1. Start server:

```bash
node apps/server/src/index.mjs
```

2. Portable preflight contract check (no live scrape):

```bash
curl -sS -X POST http://localhost:8787/api/v1/signals/browser-search \
  -H 'content-type: application/json' \
  -d '{"keyword":"learn korean","executionMode":"preflight"}'
```

3. Portable mock contract check:

```bash
curl -sS -X POST http://localhost:8787/api/v1/signals/search \
  -H 'content-type: application/json' \
  -d '{"platform":"tiktok","keywords":["learn korean"],"executionMode":"mock"}'
```

4. Live dependency introspection:

```bash
curl -sS http://localhost:8787/api/v1/signals/browser-status
curl -sS http://localhost:8787/api/v1/signals/status
```
