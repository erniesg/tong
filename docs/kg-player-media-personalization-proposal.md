# Player Media Personalization Proposal

## Summary

YouTube watch history, subtitles/transcripts, Spotify listening history, and lyrics should not become a separate product track.
They are upstream learner-signal inputs for the existing Knowledge Graph initiative.

The correct home is:

1. `#53` as the umbrella initiative.
2. `#55` as the primary implementation issue for ingesting and modeling player-specific media signals.
3. `#56` as the follow-on issue for exposing those signals through connect/sync and bootstrap APIs.
4. `#57` and `#58` as consumers of the resulting personalized objective graph, not as the place where provider logic lives.

Issue `#17` is unrelated. It stays isolated in `client-runtime`.

## What already exists

The repo already has the right conceptual backbone:

- provider-aware source modeling in `apps/server/src/ingestion.mjs`
- player-level derived model in `GET /api/v1/player/media-profile`
- vocab reinforcement surfaces in `GET /api/v1/vocab/frequency` and `GET /api/v1/vocab/insights`
- KG-backed objective output with `objectiveGraph` and `personalizedTargets`
- graph overlay suggestion fixtures and tool definitions
- Spotify connect/sync sample fixtures in `packages/contracts/fixtures/spotify.connect.sample.json` and `packages/contracts/fixtures/spotify.sync.sample.json`

That means the missing piece is not "do we support this concept?"
The missing piece is "how do live YouTube/Spotify connections become canonical learner signals?"

## Recommended architecture placement

### 1. `server-ingestion` owns normalization and learner-signal derivation

This lane should own:

- adapter mapping from live provider payloads into canonical `MediaIngestionEvent`
- transcript/lyrics token extraction and provenance
- segmentation, tokenization, and lemmatization where language-specific handling is needed
- rolling term counts and frequency windows from recent lyrics/transcripts
- topic analysis over extracted media text
- optional embedding-backed clustering when keyword/topic heuristics are not enough
- source freshness windows and replay-safe dedupe
- derived player vocab bank inputs
- cluster, placement, and objective-link scoring used by KG retrieval

This is the right home because the game should consume normalized learner signals, not raw Spotify/YouTube payloads.

### 2. `server-api` owns connect/sync endpoints and bootstrap exposure

This lane should own:

- OAuth start/callback endpoints for Spotify and YouTube
- sync triggers and sync status responses
- returning media-derived personalization through the existing bootstrap/objective flow
- demo-safe fallbacks when connectors are not configured

Provider auth and callbacks are API concerns, not graph concerns.

### 3. `game-engine` consumes personalized objectives only

This lane should only see:

- `objectiveGraph`
- `coreTargets`
- `personalizedTargets`
- reinforcement metadata needed to build a lesson/hangout/session
- placement hints for which terms belong in which location, lesson, or hangout context

Do not let the game-engine read provider-specific connector payloads directly.

## Analysis pipeline

The ingestion/retrieval path should be staged like this:

1. Extract transcript and lyric text with source/media provenance.
2. Normalize into canonical media events.
3. Segment/tokenize/lemmatize where needed per language.
4. Run rolling counts and frequency analysis over recent windows.
5. Run topic analysis and, when helpful, embedding-backed clustering.
6. Score term and cluster affinity against cities, locations, lessons, hangouts, and mission objectives.
7. Emit ranked candidates with rationale so Tong can infuse the right language into the right surface.

The important point is that embeddings are an option inside the retrieval pipeline, not a separate product layer.

## Proposed issue routing

### Keep as-is

- `#53` remains the umbrella.
- `#55` remains the main issue for retrieval inputs and player-media scoring.
- `#56` remains the API/bootstrap issue.

### Recommended adjustment

Update `#55` so its scope explicitly includes:

- live YouTube/Spotify-to-`MediaIngestionEvent` adapters
- transcript/lyrics provenance
- segmentation/tokenization/lemmatization for extracted media text
- counting/frequency windows over recent lyrics/transcripts
- topic analysis and optional embedding-backed clustering
- player-specific vocab-bank derivation from recent consumption
- retrieval hooks for "recently consumed content" term highlighting
- placement scoring for which terms/clusters belong in which locations, lessons, and hangouts

Update `#56` so its scope explicitly includes:

- connector auth/callback/sync surfaces
- sync-status payloads and demo-safe fallback behavior
- bootstrap exposure of recent-source rationale for Tong recommendations
- bootstrap exposure of ranked terms/topics and placement rationale for lesson/hangout selection

### Recommended new child issue

Add one new issue under `#53` if explicit tracking is needed:

- Title: `Provider sync surface for YouTube/Spotify learner ingestion`
- Lane: `server-api`
- Depends on: none for endpoint scaffolding, then feeds `#55` and `#56`
- Scope:
  - start/callback/connect endpoints
  - token storage contract
  - sync trigger/status payloads
  - local/demo fallback semantics

I would not create a second new issue on `server-ingestion` unless `#55` proves too broad, because the normalization and vocab-bank work already belongs there.

## Suggested delivery sequence

1. Keep using the existing contracts from closed issue `#54`.
2. Expand `#55` to make player-media ingestion explicit.
3. Add the new `server-api` connector issue only if you want auth/sync tracked separately from retrieval.
4. Land live connector ingestion into canonical events.
5. Run segmentation, counting/frequency, and topic analysis over the extracted text.
6. Add embedding-backed clustering only where it improves grouping and placement quality.
7. Feed the derived signals into frequency, insights, and `player.media-profile`.
8. Expose the result through `#56` bootstrap/objective APIs.
9. Let `#57` and `#58` consume the personalized outputs for KO pilot behavior.

## Worktree decision

No new KG-specific worktree should be created.

The repo already defines the correct split:

- `.worktrees/server-ingestion` for retrieval inputs and vocab-bank modeling
- `.worktrees/server-api` for connect/sync and bootstrap endpoints
- `.worktrees/game-engine` for objective-to-session generation

Because issue `#17` is active in `.worktrees/issue-17-client-runtime`, this proposal can proceed without collision by staying in the existing `server-ingestion` lane.

## Practical product framing

The player-facing story should be:

- Tong remembers what the player has actually been watching and listening to.
- Tong turns recent transcripts and lyrics into reviewable vocab and grammar.
- Tong uses that signal to choose lesson targets, hangout prompts, overlay highlights, and the right city/location context for reinforcement.

The implementation story should be:

- connectors -> canonical media events -> segmentation/counting/topic analysis -> vocab/insight/media-profile -> KG retrieval and placement scoring -> session generation

That keeps the feature grounded in the learning loop instead of turning it into a disconnected "integrations" side project.
