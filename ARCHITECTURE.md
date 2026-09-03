# Architecture

## 1. Principles

1. **Platform-agnostic core.** Twitch is the first provider, not the shape of
   the system. Provider logic lives behind adapters; the rest of the app only
   ever sees normalized internal events.
2. **Brand DNA is the visual source of truth.** Connected platforms are the
   live-data source of truth. Neither leaks into the other.
3. **Live paths are different from dashboard paths.** An OBS browser source and
   an analytics page have opposite requirements. They get separate runtimes,
   separate performance budgets and separate failure modes.
4. **Structured generation, never arbitrary code execution.** AI produces and
   edits validated JSON specifications. Controlled application code turns those
   specifications into widgets or compositions.
5. **Never fabricate data.** If a provider did not give us a number, the UI says
   so.

---

## 2. Deployment topology

```
                        ┌──────────────────────────────┐
                        │            Vercel            │
                        │  ┌────────────────────────┐  │
   Creator ─────────────┼─▶│ Marketing (static)     │  │
                        │  ├────────────────────────┤  │
                        │  │ Dashboard / Brand      │  │
                        │  │ Overlay Editor (SSR)   │  │
                        │  ├────────────────────────┤  │
   OBS Browser ─────────┼─▶│ /overlay/[token]       │  │
   Source               │  │ (lean runtime)         │  │
                        │  ├────────────────────────┤  │
   Twitch EventSub ─────┼─▶│ /api/webhooks/twitch   │  │
                        │  └───────────┬────────────┘  │
                        └──────────────┼───────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
      ┌───────────────┐      ┌──────────────────┐     ┌──────────────────┐
      │   Supabase    │      │  External APIs   │     │  Render Worker   │
      │ Postgres+RLS  │      │  Twitch          │     │  HyperFrames     │
      │ Auth          │      │  YouTube         │     │  + FFmpeg        │
      │ Storage       │      │  OpenAI Images   │     │  (off-Vercel)    │
      │ Realtime      │      └──────────────────┘     └──────────────────┘
      └───────────────┘
```

Vercel hosts everything request-shaped. Long video rendering does **not** run in
a serverless request — see §8.

---

## 3. Request paths and their budgets

| Path | Runtime | Budget | Notes |
| --- | --- | --- | --- |
| `/` and marketing | Static | Prerendered | Reads no session; must stay static |
| `/(auth)/*` | SSR | Fast | Proxy-matched for session refresh |
| `/(app)/*` | SSR, `force-dynamic` | Per-creator | Never cached, never prerendered |
| `/overlay/[token]` | Lean SSR + minimal JS | **Live** | No dashboard code, no session cookie |
| `/api/webhooks/*` | Route handler | **Live** | Signature-verified, no session |

The overlay and webhook routes are deliberately excluded from the proxy matcher
in `src/proxy.ts`. A browser source must never pay for a session refresh, and a
provider webhook has no session to refresh.

---

## 4. Authentication vs connected accounts

These are different concepts and the schema keeps them apart.

- A **platform account** (`auth.users` → `profiles`) is who the creator is here.
- A **connected account** (`connected_accounts`) is a channel they authorised us
  to read: Twitch today, YouTube later, more after that.

A creator can connect several channels, disconnect them, or connect none at all,
without affecting their account. Social sign-in can be added later as a
*convenience* on top of the platform account — never as a replacement for it.

### The auth chain as implemented

```
Request
  └▶ src/proxy.ts
       └▶ updateSession()  refresh cookies, getClaims() verifies the JWT
       └▶ optimistic redirect (convenience only)
  └▶ (app)/layout.tsx
       └▶ requireUser()   ← the real authorisation check
  └▶ Postgres
       └▶ Row Level Security  ← the enforcement boundary
```

Three layers, and only the last two are load-bearing. This matters: Next.js
documentation is explicit that proxy/middleware is not a session-management or
authorisation solution.

---

## 5. Data model (Phase 2 target)

UUID primary keys. Migrations under `supabase/migrations/`. RLS on every table.

```
profiles(id → auth.users, display_name, creator_type, created_at, …)
  │
  ├─ brands(id, user_id, name, description, audience, personality[],
  │         colors jsonb, typography jsonb, visual_style jsonb,
  │         motion_style jsonb, rules jsonb, is_default)
  │
  ├─ connected_accounts(id, user_id, provider, provider_user_id,
  │                     provider_channel_id, display_name, username,
  │                     avatar_url, scopes[], token_expires_at,
  │                     metadata jsonb, connected_at, updated_at)
  │        └─ tokens are NOT stored here in plaintext — see §7
  │
  ├─ assets(id, user_id, brand_id, type, source, storage_path, mime_type,
  │         width, height, duration_ms, prompt, provider, approved,
  │         favorite, created_at)
  │
  ├─ overlays(id, user_id, brand_id, name, canvas jsonb, settings jsonb,
  │           public_token, token_rotated_at)
  │        └─ overlay_widgets(id, overlay_id, type, config jsonb, z_index,
  │                           x, y, width, height, locked)
  │
  ├─ alert_configs(id, user_id, brand_id, event_type, spec jsonb,
  │                duration_ms, sound_asset_id, min_threshold, enabled)
  │
  └─ stream_events(id, user_id, provider, provider_event_id, type,
                   actor jsonb, data jsonb, is_test, occurred_at,
                   UNIQUE(provider, provider_event_id))
```

Later: `generations`, `renders`, `stream_sessions`, `channel_metrics`,
`analytics_snapshots`, then the community, monetization and usage tables.

Two schema decisions worth stating now:

- `stream_events` carries a **unique constraint on `(provider,
  provider_event_id)`**. Twitch explicitly may deliver a webhook more than once;
  deduplication has to live in the database, not in application memory.
- `overlays.public_token` is the opaque OBS identifier, separate from the row's
  UUID, so it can be rotated without breaking anything else that references the
  overlay.

---

## 6. Event architecture

```
Twitch EventSub          YouTube (polling / PubSubHubbub)
      │                            │
      ▼                            ▼
  ┌──────────────────────────────────────┐
  │        Provider Adapter              │  verify signature, dedupe,
  │  (TwitchService / YouTubeService)    │  map to internal shape
  └───────────────────┬──────────────────┘
                      ▼
          Normalized internal event
   { type, provider, creatorId, timestamp, actor, data, isTest }
                      │
                      ▼
              ┌───────────────┐
              │ EventService  │
              └───┬───┬───┬───┘
      ┌───────────┘   │   └────────────┐
      ▼               ▼                ▼
 Activity Feed   Analytics       Alert Engine
                                       │
                                       ▼
                            Realtime channel per overlay
                                       │
                                       ▼
                             OBS browser source
                                       │
                                  Alert queue
```

A test event enters at "Normalized internal event" with `isTest: true` and
travels the same path as a real one. That is the point: a creator who tests an
alert exercises the real pipeline, not a mock of it.

---

## 7. Secret handling

| Secret | Where it lives | Reaches the browser? |
| --- | --- | --- |
| Supabase publishable key | `NEXT_PUBLIC_*` | Yes — safe, RLS-guarded |
| Supabase secret key | Server env | Never |
| Twitch/YouTube OAuth tokens | Server-side, encrypted at rest | Never |
| Twitch EventSub secret | Server env | Never |
| OpenAI API key | Server env | Never |
| Overlay public token | In the OBS URL | Yes — opaque, scoped, revocable |

Provider access and refresh tokens are held in a table the publishable key
**cannot** reach (RLS denies all client access; only the secret-key client
reads it) and are encrypted at rest. They are never logged, never returned from
an API route, and never placed in a redirect URL.

---

## 8. Rendering architecture

Two different things get called "animation", and conflating them would be the
most expensive mistake available here.

**Live widget animation** — follower, subscriber, raid, cheer, goal completion.
Runs in the browser source from a template. No render job, no video file, no
network round trip beyond the event itself. Latency budget: sub-second.

**Rendered asset** — animated logo, intro, BRB screen, transition, promo. Built
with HyperFrames, rendered to MP4/WebM once, stored, reused.

```
Vercel  ──▶ create render job (queued)
                    │
                    ▼
              Job queue
                    │
                    ▼
        Render worker (NOT Vercel)
        HyperFrames + FFmpeg
                    │
                    ▼
        Object storage ──▶ assets row ──▶ available everywhere
```

`RenderService` is an interface with a queue behind it, so the worker's host can
be chosen later — and changed later — without touching application code. During
local development the worker may simply run on the developer's machine.

**Never send a live event through a render job.**

---

## 9. Service boundaries

Responsibilities, not microservices. All in-process until something proves it
needs to move.

```
BrandService          ConnectedAccountService   ImageGenerationService
AssetService          TwitchService             MotionGenerationService
OverlayService        YouTubeService            RenderService
AlertService          EventService              StorageService
AnalyticsService      RealtimeService           UsageService
```

`UsageService` exists from early on even though billing does not. Image
generation and video rendering cost real money; an architecture that cannot
measure them cannot later constrain them.

---

## 10. Architecture review

Verification that the design supports each required capability, and where it
strains.

| Requirement | Supported | Notes |
| --- | --- | --- |
| Vercel deployment | ✅ | Everything except video rendering |
| Supabase (PG/Auth/Storage/Realtime) | ✅ | RLS from Phase 2 |
| Twitch OAuth | ✅ | Server-side code flow, state in an HTTP-only cookie |
| Twitch events | ✅ | EventSub webhooks to a route handler |
| OBS browser sources | ✅ | Dedicated lean route, opaque token |
| Realtime to OBS | ✅ | Supabase Realtime behind `RealtimeService` |
| Brand DNA | ✅ | `brands` table, JSONB, versionable |
| HyperFrames | ⚠️ | Not installed here — see risk R1 |
| OpenAI images | ✅ | Server-side only, behind `ImageGenerationService` |
| Dedicated rendering later | ✅ | Queue + worker, provider-agnostic |
| YouTube later | ✅ | Same adapter shape as Twitch |

### Risks

**R1 — HyperFrames is not present in this environment.** *Blocking for Phase 8.*
No HyperFrames skill is installed and no HyperFrames CLI is available. A public
npm package named `hyperframes` (0.8.27, "HyperFrames CLI — create, preview and
render HTML video compositions") matches the described workflow, but nothing in
this repository or environment confirms it is the intended one. Phase 8 must not
begin until the correct skill/CLI is installed and its own documentation is read
as the source of truth. Everything in `docs/hyperframes.md` is a plan, not an
implementation.

**R2 — FFmpeg is not installed.** *Blocking for Phase 8 rendering.* Video
rendering needs it. This reinforces §8: rendering belongs on a worker with a
controlled image, not in the web runtime.

**R3 — Vercel execution limits versus video rendering.** A render can exceed any
serverless timeout. Mitigated by design: jobs are queued and the UI polls status.
The worker host is still an open decision — deliberately deferred so it is not
made before there is a real workload to size it against.

**R4 — Supabase Realtime under alert load.** Fine at the scale of one creator's
overlay, unproven at a burst of thousands of concurrent browser sources. Mitigated
by keeping realtime behind `RealtimeService` so the transport can be swapped
without touching the widget runtime. Revisit before public launch, not before.

**R5 — Twitch EventSub webhooks require a public HTTPS URL.** Local development
cannot receive them directly; a tunnel or the WebSocket transport is needed for
development. Phase 7 must decide this explicitly rather than discovering it.

**R6 — Provider API drift.** Twitch and YouTube endpoints, scopes and event
names change; `channel.follow` in particular has changed its authorisation
requirements before. Every provider phase starts by reading the current official
documentation. Nothing in these docs should be treated as verified API behaviour.

**R7 — Provider data retention.** Storing analytics snapshots is necessary to
show history without hammering APIs, but both Twitch and YouTube constrain what
may be stored and for how long. Phase 4 and Phase 10 must check the developer
terms before designing their snapshot tables.

**R8 — Supabase legacy API keys are being retired.** The `anon` and
`service_role` keys are scheduled for removal. The code prefers the new
publishable/secret keys and falls back to the legacy names, so migration is a
configuration change rather than a code change.

**R9 — Next.js 16 is dynamic by default.** Pages are no longer implicitly
cached. Good for a per-creator dashboard, but it means any future caching must
be opted into deliberately with `use cache`, and marketing pages must be kept
free of session reads to stay static. `src/app/page.tsx` follows this rule and
says so in a comment.

### Deliberately deferred

The render worker's host, the realtime transport at scale, the entitlements
model, and the custom-widget sandbox. Each is behind an interface. None needs
deciding before Phase 7, and deciding early would mean guessing.
