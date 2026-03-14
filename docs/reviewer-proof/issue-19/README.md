# Issue 19 Reviewer Proof

This folder contains reviewer-openable proof for [issue #19](https://github.com/erniesg/tong/issues/19): dialogue is not truly streamed to the player, even though the transport is streamed.

Capture path:

- deterministic near-proof setup using `/game?dev_intro=1&dev_act=2`
- live model response on the actual `/api/ai/hangout` route
- mobile viewport recording

Files:

- `issue19-stream-proof.webm`: recorded mobile repro from `/game?dev_intro=1&dev_act=2`
- `issue19-stream-proof.gif`: lightweight inline preview of the same capture
- `01-loading-pulse.png`: loading state before dialogue is visible
- `03-first-dialogue-frame.png`: first readable dialogue frame
- `04-dialogue-incremental-frame.png`: later typewriter frame
- `05-dialogue-complete-frame.png`: completed visible line
- `chunk-render-proof.json`: chunk arrival and DOM render timeline

Key proof points from `chunk-render-proof.json`:

- `/api/ai/hangout` request starts at `+69ms`
- first response chunk arrives at `+1127ms`
- completed `npc_speak` chunk arrives at `+3098ms`
- response stream finishes at `+3135ms`
- first visible dialogue text renders at `+3164ms`

At that first visible render, the on-screen text is only `So y`, while QA state already holds the full `currentMessage.contentPreview` string. That means the visible character-by-character effect is local typewriter animation over a finished payload, not progressive rendering from partial model or tool deltas.
