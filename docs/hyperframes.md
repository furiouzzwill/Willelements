# HyperFrames

**Status: BLOCKED. Not installed in this environment. Nothing here is implemented.**

## Current state

Phase 0 discovery found:

- **No HyperFrames skill installed** — not in `~/.claude/skills`, not in
  `/mnt/skills`, not in the plugin directories.
- **No HyperFrames CLI available.**
- **No FFmpeg** on this machine.

A public npm package named `hyperframes` exists (version 0.8.27, described as
"HyperFrames CLI — create, preview, and render HTML video compositions") and
matches the described workflow. Nothing in this repository or environment
confirms it is the intended tool, so it has **not** been installed.

**Phase 8 must not begin until the correct skill and CLI are installed.** When
they are, that skill is the source of truth and overrides everything below.

## Intended role

HyperFrames is the motion-generation system for **rendered assets**:

Animated logos · alerts as reusable motion concepts · transitions ·
Starting Soon · BRB · Stream Ending · lower thirds · social popups ·
celebration and promo animations.

## The distinction that matters most

| Rendered asset | Live widget animation |
| --- | --- |
| Animated logo, intro, BRB, transition, promo | Follower, subscriber, raid, cheer, goal |
| Built with HyperFrames | Runs in the browser source |
| Rendered once to MP4/WebM | Plays from a template, per event |
| Stored and reused | Never rendered per event |
| Seconds to minutes | Sub-second |

**Never send a live event through a render job.** Reuse approved motion
templates inside the browser runtime instead. Getting this wrong would make
alerts slow, expensive and fragile — the three things a live tool cannot be.

## Intended workflow

Per the described process, subject to the installed skill:

```
Scaffold → Build composition → Lint → Inspect → Preview → Fix → Render
```

Roughly `npx hyperframes init` / `lint` / `inspect` / `preview` / `render` —
but **use whatever the installed skill specifies**, not these remembered
commands.

Always define the visual identity from Brand DNA before generating a
composition.

## Rendering infrastructure

Video rendering does not belong in a Vercel serverless request.

```
Vercel ─▶ create render job ─▶ queue ─▶ render worker ─▶ storage ─▶ asset
                                    (HyperFrames + FFmpeg)
```

Job states: `queued`, `processing`, `completed`, `failed`, `cancelled`.
Metadata: render ID, user, brand, project, type, status, progress, output asset,
error code, and the created/started/completed timestamps.

The UI never blocks on a render. `RenderService` stays provider-agnostic so the
worker's host can be chosen — and changed — later. During local development,
rendering may simply run on the developer's machine.
