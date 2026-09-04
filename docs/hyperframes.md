# HyperFrames

**Status: implemented in Phase 9.** Three composition templates render end to
end on this machine.

## What it is here

HyperFrames is the motion system for **rendered assets** — files you add to an
OBS scene as a media source. A composition is a standalone HTML file driven by a
paused GSAP timeline; the CLI opens it in a headless Chrome, captures every
frame, and encodes the result with FFmpeg.

Nothing about that is a library call. The CLI is a subprocess, and the
composition is a file on disk you can open in a browser yourself.

## The distinction that matters most

| Rendered asset | Live widget animation |
| --- | --- |
| Animated logo, scene card, lower third | Follower, subscriber, raid, cheer, goal |
| Built with HyperFrames | Runs in the browser source |
| Rendered once to MP4/WebM | Plays from a template, per event |
| Stored and reused | Never rendered per event |
| Seconds to minutes | Sub-second |

**Never send a live event through a render job.** Alerts stay in the browser
runtime. Getting this wrong would make them slow, expensive and fragile — the
three things a live tool cannot be.

## Requirements

Rendering needs three things this app does not ship:

| | Why |
| --- | --- |
| **FFmpeg** (and `ffprobe`) | Encodes the captured frames |
| **Headless Chrome** | Renders and captures them — fetched by the CLI itself |
| **HyperFrames CLI** | Drives both |

The animations page probes for all three with `hyperframes doctor --json` and
says exactly what is missing. It gates on the checks rendering actually needs —
not on doctor's overall `ok`, which goes false for optional extras this app has
no use for (local transcription, local TTS, a running Docker daemon).

The CLI is resolved in this order, so a pinned install always wins over a
download:

1. `$HYPERFRAMES_CLI`
2. `node_modules/.bin/hyperframes`
3. `hyperframes` on `PATH`
4. `npx --yes hyperframes@0.8.27` — needs the network on a first run

## GSAP is vendored, not fetched

Every generated composition loads `assets/vendor/gsap.min.js` — a local copy,
committed at `vendor/gsap/`. The first version of this pipeline used a CDN tag
and every render failed with a navigation timeout. Beyond that: a render should
not depend on the network, and the same composition should produce the same
video a year from now. See `vendor/gsap/README.md`.

There is a test that fails if any generated composition contains an `http://` or
`https://` URL at all.

## Brand DNA becomes a visual identity

`src/lib/hyperframes/identity.ts` is the whole of the translation, and the only
place it happens. Templates read the identity, never the DNA — so two templates
cannot disagree about what "high energy" means.

| Brand DNA | Becomes |
| --- | --- |
| `motionStyle.speed` | Base beat duration — 1s slow, 0.7s medium, 0.45s fast |
| `motionStyle.energy` | Travel distance (24–88px) and stagger (0.1–0.05s) |
| `motionStyle.style[0]` | Easing curves, plus a duration and travel multiplier |
| `motionStyle.style[*]` | Accents — glitch, sweep, bloom, vignette — from *every* entry |
| `visualStyle.style` | Case, tracking, weight, corner radius |
| `visualStyle.detail` | Hairline weight, grain, vignette, glow |
| `visualStyle.canvas` | Lightens or darkens the brand background to match |
| `colors` | CSS custom properties, contrast-corrected |

Contrast is decided here rather than left to the template, because `hyperframes
check` audits it and because nobody is going to squint at a rendered video and
adjust a shade. Two rules do the work:

- **`ensureContrast`** keeps the brand's own colour and nudges it only if it
  genuinely fails. Body ink stays the near-black the brand chose instead of
  being replaced by pure black for a gain nobody can see.
- **`bestContrastAcross`** picks text for a *gradient* by maximising the worst
  of its two backgrounds. The weakest point is the one people notice.

Fonts are **not** loaded. A composition names the brand's families and falls
back to system fonts, so a font the machine does not have renders as its
fallback rather than failing.

## The templates

| Template | Length | Format | Notes |
| --- | --- | --- | --- |
| `logo-sting` | derived, 2.5–6s | MP4 | Mark, wordmark, rule, optional tagline |
| `scene-card` | 8s | MP4 | Starting Soon / BRB / Ending — **loops seamlessly** |
| `lower-third` | derived, ~4–5s | WebM | **Transparent** — plays over gameplay |

Two of those choices are worth spelling out.

**The scene card has no entrance animation.** It plays in OBS as a looping media
source, and a frame that does not continue into frame zero shows as a jump every
few seconds. So every tween is cyclic: a full 360° rotation, or a yoyo running an
even number of legs that divide the loop exactly. There is a test that fails if
a yoyo tween is left with an odd number of legs.

**The lower third is WebM because H.264 has no alpha channel.** The format
follows the intent, not the default. It also skips the decorative full-frame
layers a scene card uses — a vignette over a transparent composition is a tint
over the whole stream.

Lengths are derived from the identity rather than fixed: a brand set to slow,
cinematic motion genuinely needs a longer sting, and cutting it to a fast
brand's length would clip it.

## Rendering

```
createRenderJob ─▶ render_jobs row ─▶ single-worker queue
                                         │
                                         ├─ write data/renders/<job>/
                                         ├─ probe the toolchain
                                         ├─ spawn the CLI, parse its progress
                                         └─ ingest the output as an asset
```

Job states: `queued`, `processing`, `completed`, `failed`, `cancelled`.

**One render at a time**, deliberately. This is the same machine that encodes the
stream, and the CLI already parallelises frame capture internally, so a second
concurrent job buys nothing and doubles the cost. The page warns if you are live.

The UI never blocks on a render. The queue polls `/api/renders` while anything is
running and stops the moment everything is terminal.

Interrupted jobs are closed out at boot: their child processes died with the
server, and a progress bar that can never move is worse than an honest failure.

Project directories are kept after the render. When a video comes out wrong, the
HTML that produced it is the only thing that explains why, and it is a few
kilobytes. They are excluded from backups — the finished video is an asset and
is backed up; the project is reproducible.

## The authoring loop, if you write a template by hand

```bash
npx hyperframes lint      # fast, while editing
npx hyperframes check     # the real gate — reruns lint, then opens a browser
npx hyperframes render --quality draft --output out.mp4
```

`check` audits runtime errors, failed requests, layout overflow and WCAG
contrast at sampled timestamps. All three shipped templates pass it clean on
brands as different as a dark neon gaming palette and a light luxury one.
