# Architecture

## 1. What this is

A **local, single-user application**. It runs on the streamer's own machine,
stores everything in one folder, and talks to the outside world only to reach
the streaming platforms it connects to.

That constraint is the most important fact about this design. It removes
authentication, multi-tenancy, row-level access rules, hosting and running
costs — and it makes the live path *shorter*, because OBS is on the same
machine as the server pushing events to it.

## 2. Principles

1. **Platform-agnostic core.** Twitch is the first provider, not the shape of
   the system. Provider logic sits behind adapters; the rest of the app only
   sees normalized internal events.
2. **Brand DNA is the visual source of truth.** The connected platform is the
   live-data source of truth. Neither leaks into the other.
3. **Live paths differ from dashboard paths.** An OBS browser source and a
   settings page have opposite requirements and get different budgets.
4. **Structured generation, never arbitrary code execution.** AI produces
   validated JSON; controlled code turns it into widgets or compositions.
5. **Never fabricate data.** If a provider did not give us a number, say so.

---

## 3. Topology

```
                    Your machine
   ┌───────────────────────────────────────────────┐
   │                                               │
   │   Next.js (localhost:3000)                    │
   │   ├── Dashboard, Brand Studio, Editor         │
   │   ├── /overlay/{token}  ──────────┐           │
   │   └── EventSub WebSocket client   │           │
   │              │                    │ SSE       │
   │              ▼                    ▼           │
   │   ┌──────────────────┐     ┌──────────────┐   │
   │   │  data/app.db     │     │ OBS Browser  │   │
   │   │  data/assets/    │     │ Source       │   │
   │   └──────────────────┘     └──────────────┘   │
   │                                               │
   └───────────────┬───────────────────────────────┘
                   │ outbound only
                   ▼
         Twitch  ·  YouTube  ·  OpenAI
```

Nothing listens on a public port. Nothing is uploaded. The only inbound
connection is OBS on the same machine.

---

## 4. Storage

**SQLite** via `better-sqlite3`, with `drizzle-orm` for typed queries.

- One file, `data/app.db`. Back up by copying the folder.
- **WAL journal mode**, so the overlay's reads never block on a write. Events
  arrive while the browser source is reading; a stall there would be visible on
  stream.
- `foreign_keys = ON`, `busy_timeout = 5000`.
- Migrations are hand-written SQL tracked by SQLite's own `user_version`. No
  migration CLI — which also means no `drizzle-kit`, and no dependency
  advisories from it. Append-only: never edit a shipped migration.
- Replacing the database file requires closing the connection first. An open
  connection holds a write-ahead log describing the *old* database, and SQLite
  will replay it over the restored one — a bug the backup tests caught.
- Migrations take the write lock with `BEGIN IMMEDIATE` and re-read
  `user_version` inside it, because `next build` runs several workers that each
  open the database.
- The connection opens **lazily on first use**, not at module load, so a build
  does not create a data directory as a side effect.

### Schema

```
brands ───────────┐  Brand DNA as JSON: colors, typography,
                  │  visual style, motion style, rules
assets ───────────┤  Uploaded + generated files; bytes on disk,
                  │  metadata and provenance in the database
overlays ─────────┤  Canvas + settings + opaque public_token
  └─ overlay_widgets
alert_configs ────┤  Per event type: spec, template, duration, sound
connected_accounts┤  One row per provider; tokens encrypted at rest
stream_events ────┘  Normalized events, UNIQUE(provider, provider_event_id)
```

Two decisions worth stating:

- `stream_events` has a **unique constraint on `(provider, provider_event_id)`**.
  Twitch may deliver the same event twice; deduplication belongs in the
  database, not in application memory that dies with the process.
- `overlays.public_token` is separate from the row's `id`, so it can be rotated
  without breaking anything that references the overlay.

---

## 5. The live path

This is what has to work while someone is streaming.

```
Twitch EventSub (WebSocket)
        ▼
  Provider adapter          verify, dedupe, normalize
        ▼
  Normalized event          { type, provider, timestamp, actor, data, isTest }
        ▼
  EventService
   ├─▶ stream_events        persisted
   ├─▶ Activity feed
   └─▶ Alert engine
         ▼
       Alert queue          sequence, don't overlap
         ▼
       SSE  ──────────────▶ /overlay/{token} in OBS
```

### Why EventSub over WebSocket, not webhooks

Webhook delivery needs a public HTTPS URL. A local app has none, and requiring
a tunnel would make the whole thing fragile. Twitch's **WebSocket transport**
exists for exactly this case: the app dials out to Twitch and receives events on
that connection. No inbound port, no tunnel, no certificate.

This is the single biggest benefit of going local, and it removed what was the
largest risk in the earlier cloud design.

### Why SSE for the overlay

The overlay only ever *receives*. Server-Sent Events fit that exactly:

- One-way, so no WebSocket handshake or protocol overhead.
- `EventSource` reconnects automatically in the browser — no reconnect logic to
  write, and a browser source that sat in OBS for a week recovers on its own.
- Works in a plain Next.js route handler; no second server process.

A browser source pays for none of the dashboard: no session, no shell, no editor
bundle.

---

## 6. Secrets

| Secret | Where | Reaches the browser? |
| --- | --- | --- |
| Twitch OAuth tokens | `connected_accounts`, AES-256-GCM at rest | Never |
| `TOKEN_ENCRYPTION_KEY` | Environment | Never |
| OpenAI API key | Environment | Never |
| Overlay public token | In the OBS URL | Yes — opaque, rotatable |

Provider tokens are encrypted before they touch the database, so a copied
`app.db` is not usable on its own. They are never logged, never returned from a
route handler, and never placed in an overlay URL.

Server-only modules import `server-only`, which turns a mistaken client import
into a build error. This is verified, not assumed — importing the database layer
into a Client Component fails the build.

Only `connected-account-service` ever handles a plaintext provider token. What
it hands to the rest of the app is an `AccountSummary` with no token fields at
all, so there is no route, page or log line that could leak one. Token request
failures deliberately discard the response body, which can echo the credential
back.

The OAuth `state` is validated **before** the authorization code is exchanged,
so a forged callback never causes a token request. The state cookie is
HTTP-only and single-use — cleared whether the comparison passes or fails.

---

## 7. Rendering

Two different things get called "animation", and conflating them would be the
most expensive mistake available here.

**Live widget animation** — follower, subscriber, raid, cheer, goal. Runs in the
browser source from a template. No render job, no video file. Sub-second.

**Rendered asset** — animated logo, intro, BRB, transition, promo. Built with
HyperFrames, rendered once to MP4/WebM, stored in `data/assets`, reused.

Locally, rendering is a background job on the same machine — it does not block
the UI, and it does not need a worker service. **Never send a live event through
a render job.**

---

## 8. Services

Responsibilities, not microservices. All in-process.

```
BrandService     OverlayService    EventService      RenderService
AssetService     AlertService      TwitchService     ImageGenerationService
SetupService     AnalyticsService  YouTubeService    MotionGenerationService
```

Deliberately thin. There is no repository pattern and no dependency injection —
the storage layer is a local SQLite file that is not going to be swapped, and
abstraction that exists only to allow a swap that will not happen is a cost with
no return.

---

## 9. Architecture review

| Requirement | Supported | Notes |
| --- | --- | --- |
| Runs locally, no account | ✅ | No auth layer at all |
| Zero running cost | ✅ | Only OpenAI (Phase 9) ever costs money |
| Persistent storage | ✅ | SQLite + files in `data/` |
| Twitch OAuth | ✅ | Implemented — loopback redirect, encrypted tokens |
| Twitch events | ✅ | EventSub **WebSocket** — no public URL needed (Phase 7) |
| OBS browser sources | ✅ | Lean route, opaque token, SSE |
| Brand DNA | ✅ | JSON columns on `brands` |
| HyperFrames | ⚠️ | Not installed — risk R1 |
| OpenAI images | ✅ | Server-side, behind a service |
| YouTube later | ✅ | Same adapter shape as Twitch |

### Risks

**R1 — HyperFrames is not installed.** *Blocking for Phase 8.* No skill, no CLI.
A public npm package `hyperframes` (0.8.27) matches the described workflow, but
nothing here confirms it is the intended one. Phase 8 does not start until the
correct tooling is installed and its own documentation read as the source of
truth.

**R2 — FFmpeg is not installed.** *Blocking for Phase 8 rendering.* Needs
installing on whatever machine runs the app.

**R3 — The app must be running for alerts to work.** If it is closed or crashes
mid-stream, alerts stop. This is true of every local streaming tool, but it is a
real operational property: start it before going live, and Phase 6 should make
the overlay visibly indicate a lost connection rather than silently doing
nothing.

**R4 — One machine, no redundancy.** *Mitigated in Phase 2.* Settings exports a
zip of the database and every asset, and restores one. The database is captured
with SQLite's backup API rather than a file copy, so a snapshot taken while the
app is running is consistent. Taking a backup is still a manual act — nothing
schedules it, and nothing stores a copy off this machine.

**R5 — Provider API drift.** Twitch and YouTube endpoints, scopes and event
names change; `channel.follow` has changed its authorisation requirements
before. Every provider phase begins by reading current official documentation.
Nothing in these docs is verified API behaviour.

**R6 — Token encryption key management.** *Resolved in Phase 4.* Provider tokens
are sealed with AES-256-GCM. The key lives in `data/.token-key`, mode 0600,
generated on first use, and can be overridden with `TOKEN_ENCRYPTION_KEY`. It is
outside the database, so a copied `app.db` — or a backup zip shared for support
— does not hand over control of the channel.

Losing the key means reconnecting Twitch, and nothing else. That is the
deliberate trade, and the app states it: an unreadable token surfaces as
"reconnect the platform", not as an error.

**R7 — Native module portability.** `better-sqlite3` compiles per platform and
Node version. It installs from a prebuilt binary on common setups, but a Node
upgrade can require `npm rebuild`. Worth knowing before it happens mid-stream.

**R8 — Next.js 16 is dynamic by default.** Pages are no longer implicitly
cached, which suits an app whose data changes as you use it. Any future caching
must be opted into deliberately.

### If this ever becomes multi-user

It would need auth, an owner column on every table, and access rules — a real
project, not a config change. The schema does not prevent it (nothing assumes a
single row anywhere), but nothing has been built to enable it either. That was a
deliberate call: paying for that flexibility now, in code you read every day,
buys nothing today.
