# Hackathon TODOs (Living Checklist)

## Planning + Repo Hygiene
- [x] Add tracked execution plan for fresh Tong build
- [x] Add living TODO checklist
- [x] Add gitignored local reference-notes path
- [x] Add root scripts for client/server/ingestion workflows

## Contracts + Data
- [x] Add typed contracts module under `packages/contracts`
- [x] Add server-side mock media input fixture for ingestion
- [x] Keep demo smoke checks aligned with required fixtures/contracts

## Server (apps/server)
- [x] Create runnable server package with dev/start scripts
- [x] Implement core contract endpoints (`captions`, `dictionary`, `frequency`, `insights`, `game`, `profile`)
- [x] Implement learn session endpoints (`GET/POST /learn/sessions`)
- [x] Implement hangout endpoints (`start`, `respond`) with XP/SP/RP updates
- [x] Implement mock ingestion endpoint + persistence for generated snapshots

## Web Client (apps/client)
- [x] Build home launcher page for demo tracks
- [x] Build `/overlay` review page with dictionary popover
- [x] Build `/game` mobile-first UI for start/resume, hangout, learn session history/new session
- [x] Build `/insights` page with frequency + topic visualization
- [x] Add API helper layer and environment config

## Chrome Extension (apps/extension)
- [x] Create fresh MV3 extension scaffold in Tong repo
- [x] Implement YouTube overlay content script using Tong API
- [x] Implement token dictionary click/popover in extension
- [x] Add popup links and extension test instructions
- [x] Match production karaoke interaction on YouTube (timed progression + romanization lane)

## Verification + Docs
- [x] Run `npm run demo:smoke`
- [x] Run mock ingestion and verify insights render in web UI
- [x] Sanity-check client build and critical routes
- [x] Write concise review/test runbook for all three demo areas

## Graph Progression Kernel
- [x] Add product spec for graph-driven progression, lessons, hangouts, and mission gates
- [ ] Extend shared graph contracts with language summary, mission gate status, next unlocks, and item-level target progress
- [ ] Derive item-level progress from evidence in `apps/server/src/curriculum-graph.mjs`
- [ ] Compute learner-facing `languageTier` and progress-to-next-tier from graph evidence
- [ ] Expose explicit `next unlocks` and `why blocked` data from graph APIs
- [ ] Add one explicit Seoul Food Street mission gate with ready / not-ready state

## Graph-Driven Product Integration
- [ ] Make `/graph` show overall language tier, next unlock path, mission gate, and per-node remaining target items
- [ ] Make Learn mode consume graph lesson bundles and missing target items for session setup
- [ ] Make Hangout mode check graph readiness before spending SP and starting a paid validation run
- [ ] Ensure lesson + hangout evidence updates graph state immediately in the UI
- [ ] Add smoke checks that verify next lesson, hangout readiness, and mission readiness for a runtime learner
