# Roadmap

Each phase is focused, testable and shippable. A phase is not complete until
typecheck, lint and build all pass and its exit criteria are demonstrably met.

**Current position: Phase 6 complete.**

---

## The goal

Phases 1–7 exist to make exactly this work, end to end:

1. Open the app → 2. Set up your brand → 3. Upload a logo →
4. Connect Twitch → 5. Create an overlay → 6. Configure a branded follower
alert → 7. Copy the browser-source URL → 8. Paste it into OBS →
9. Trigger a test alert → 10. See it in OBS → 11. Receive a real Twitch follow →
12. See it in the dashboard → 13. See the alert fire in OBS.

Everything through here costs nothing to run. Until it is reliable, resist
expanding into anything else.

---

## Phase 0 — Discovery ✅

- [x] Node 22.22.2, npm 10.9.7, git 2.43.0
- [x] **FFmpeg: not installed** (risk R2)
- [x] **HyperFrames skill and CLI: not available** (risk R1)
- [x] No Docker daemon; no project environment variables
- [x] Findings recorded in `ARCHITECTURE.md` §9

---

## Phase 1 — Foundation ✅

- [x] Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4
- [x] Design system tokens, separate from creator Brand DNA
- [x] UI primitives and the application shell
- [x] **Local SQLite storage** — `better-sqlite3` + `drizzle-orm`
- [x] Hand-written migrations tracked by `user_version`, concurrency-safe
- [x] Lazy connection so builds don't create a data directory
- [x] Full schema: brands, assets, overlays, overlay_widgets, alert_configs,
      connected_accounts, stream_events
- [x] `server-only` guards on the database layer, verified to fail the build on
      a client import
- [x] Dashboard with a setup checklist read from real database state
- [x] Storage settings page showing paths, schema version and row counts
- [x] Typecheck, lint and production build clean; write→read round trip verified
- [x] Documentation rewritten for the local architecture

**No authentication, by design.** One machine, one person, one folder.

---

## Phase 2 — Data foundations ✅

- [x] Zod schemas for every JSON column: Brand DNA, widget config, alert spec,
      normalized event
- [x] Typed read/write helpers — reads fall back to defaults and warn, writes
      are strict, so no JSON column is ever `any`
- [x] Full brand service: create, update, delete, set default
- [x] A starter brand seeded on first run, synchronously during connection setup
- [x] Asset storage with **content-sniffed** type detection, a 25 MB cap and
      generated content-addressed filenames
- [x] Asset serving route, immutable-cached, no path-traversal surface
- [x] Backup export and restore as a single zip (risk R4)
- [x] 40 tests via `node:test` — zero test dependencies

**Exit met:** a brand round-trips with full type safety, and the data folder
exports and restores.

Two bugs this phase found and fixed:

- Restoring a backup left the *old* write-ahead log in place, which SQLite then
  replayed over the restored database — silently undoing the restore. The
  connection is now closed and the stale WAL removed before the file is
  replaced.
- The database opened at module load, so `next build` created a data directory
  as a side effect, and parallel build workers raced the migration.

---

## Phase 3 — Brand system ✅

- [x] Brand Studio: identity, colours, typography, visual style, motion style
- [x] Live preview — a follower alert rendered in your brand, updating as you
      edit, before you save
- [x] Logo upload through the validated asset pipeline, with primary selection
      and a transparency checkerboard so you can judge it against stream footage
- [x] Personality and prefer/avoid rules as free text, since the useful entries
      are specific in a way a fixed list could not anticipate
- [x] Asset library
- [x] First-run onboarding — three fields, then straight into the studio
- [x] Form primitives: colour field, tag input, choice groups, select, textarea

**Exit met:** a complete Brand DNA is saved, survives a restart, and drives the
preview. Verified by driving the real UI in a browser: fresh install →
onboarding → Brand Studio → save DNA → upload logo → logo appears in the
preview and the library.

Design note: colours, fonts, visual style, motion style and rules are sections
of one Brand Studio page rather than five separate routes. They are edited
together against one preview, and splitting them would have meant five
near-empty screens.

A bug this phase found: `saveAsset` relied on the database module having created
the assets directory, so an upload would fail with ENOENT if that folder was
ever removed. It now ensures the directory itself.

---

## Phase 4 — Twitch connection ✅

Official docs were read before any code was written. What that changed:

- Refresh **rotates the refresh token**. Storing the one we sent would work
  exactly once and then the connection would die with nothing to point at.
- `channel.follow` v2 requires `moderator:read:followers` — which is also the
  only scope we need, so that is the entire request.
- `channels/followers` always returns `total`, but only returns the follower
  list to the broadcaster. An empty list means "not authorised", not "none".

- [x] Authorisation code flow with a localhost redirect, derived in one place
      because Twitch matches it character for character
- [x] CSRF state in a single-use HTTP-only cookie, validated **before** the code
      is exchanged so a forged callback never triggers a token request
- [x] AES-256-GCM encryption at rest, key held outside the database in
      `data/.token-key`, generated on first use (risk R6 resolved)
- [x] Refresh five minutes ahead of expiry, persisting the rotated token
- [x] Rejected refresh becomes "reconnect", not a crash
- [x] Disconnect revokes with Twitch before forgetting locally
- [x] Live status, follower count and recent follows on the dashboard
- [x] Connect / disconnect UI, with setup instructions when credentials are absent

**Exit met**, except for one step that needs your credentials: the OAuth flow
was exercised end to end against a stubbed Twitch and, with fake credentials,
against the real Twitch endpoint up to the token exchange. **The exchange itself
has not run against real Twitch** — that needs a registered app.

A significant bug this phase found: a shared timestamp helper in the Drizzle
schema hardcoded the column name `created_at`, so every `updated_at`,
`connected_at` and `token_rotated_at` field was mapped to the wrong column —
silently overwriting `created_at` on tables that had one, and failing outright
on `connected_accounts`. A general schema/migration agreement test now checks
every column of every table.

---

## Phase 5 — Overlay runtime ✅

- [x] Overlay CRUD, list and detail
- [x] Opaque 128-bit `public_token`, rotatable — the old URL dies the moment
      you rotate, and a rotated or unknown token renders an empty transparent
      page rather than an error over the gameplay
- [x] `/overlay/[token]` — transparent, its own layout, none of the dashboard's
      JavaScript
- [x] SSE endpoint with 20s heartbeats, disconnect cleanup, and buffering
      disabled so alerts are not delivered late in a batch
- [x] **Alert queue** — brought forward from Phase 6. Firing several events at
      once is the first thing anyone tries, and retrofitting a queue into a
      shape that assumes one alert at a time is far more expensive than building
      it now
- [x] Test alerts through the real pipeline, reporting how many sources received
      them so pressing Test with OBS closed says so rather than appearing to work
- [x] In-page preview over a stand-in for gameplay, so transparency and contrast
      are judged honestly
- [x] Copy browser-source URL with OBS setup steps

**Exit met**, verified by driving a real browser exactly as OBS does: created an
overlay, opened its URL in a separate page, confirmed the computed background is
`rgba(0, 0, 0, 0)`, fired a test alert from the dashboard and watched it render
in the overlay page, fired three in quick succession and confirmed only one was
ever on screen, rotated the token and confirmed the old URL returned 404.

---

## Phase 6 — Alert system ✅

Every event type, not just follows — the work was the same once the config
existed.

- [x] Per-event editor: label, message template, duration, layout, entrance and
      exit animation, element animations, logo toggle, sound and volume
- [x] Configs created for every event type on first read, so a fresh database
      and an existing one behave identically and a new event type in a later
      phase needs no migration
- [x] Brand DNA drives the styling throughout
- [x] Six real entrance animations, transform and opacity only — the two
      properties a browser composites without laying out or painting again,
      which matters when the same machine is encoding a stream
- [x] Minimum thresholds, so a 100-bit cheer alert stays quiet for a 50-bit one
- [x] Sound upload and playback, with a refused autoplay never taking the visual
      alert down with it
- [x] Alerts queue (delivered in Phase 5)
- [x] **One renderer** shared by the OBS runtime, the alert editor preview and
      the Brand Studio preview — so a preview cannot drift from what plays
- [x] Previews are true miniatures: the alert is laid out at 1920×1080 and
      scaled as a whole, so line breaks land exactly where they will on stream
- [x] Connection-lost state on the overlay after a 6s grace period (risk R3)

**Exit met**, verified by driving a browser as OBS: configured a follow alert
with a custom label, template, 3s duration and glitch entrance; confirmed it
persisted across a reload; opened the overlay URL in a separate page; fired the
alert and confirmed the configured text rendered; measured it clearing after
~3.3s (3s + exit); disabled the alert and confirmed it no longer fires.

The overlay editor and widgets moved to Phase 8 — alerts are the widget that
matters, and placing static images is worth less than getting real Twitch events
flowing first.

Three bugs this phase found:

- The word-reveal animation used a CSS gap for word spacing, so the alert's text
  read "WELCOMEIN" — identical on screen, wrong for a screen reader, wrong when
  copied, and wrong for anything reading the page.
- Six navigation items were unlocked without a page behind them, so Next
  prefetched them and got a stream of background 404s. A test now checks every
  unlocked destination against the routes on disk.
- Two navigation entries pointed at the same page.

---

## Phase 7 — Twitch events

- [ ] **EventSub WebSocket client**: welcome, keepalive, reconnect, revocation
- [ ] Create subscriptions via Helix using the session ID
- [ ] Reconnect with backoff; surface connection state in the UI
- [ ] Normalize into the internal event shape
- [ ] Persist to `stream_events`, deduplicated by the unique constraint
- [ ] Activity feed
- [ ] Push to the overlay over SSE

**Exit:** a real Twitch follow appears in the activity feed *and* fires the
alert in OBS. **This is the milestone.**

---

## Phase 8 — HyperFrames

> **Blocked** until the HyperFrames skill and CLI are installed (risk R1) and
> FFmpeg is available (risk R2).

- [ ] Install and verify the tooling; read it as the source of truth
- [ ] Convert Brand DNA into a HyperFrames visual identity
- [ ] Animated logo as the first composition
- [ ] Background render jobs with status in the UI
- [ ] Rendered output stored in `data/assets`

**Do not** move live alerts onto pre-rendered video.

---

## Phase 9 — OpenAI images

> Verify the current image API, model names and sizes first.
> **This is the only part of the project that costs money.**

- [ ] `ImageGenerationService`, server-side only
- [ ] Logo concepts and stream backgrounds
- [ ] Brand DNA feeds the prompt
- [ ] Assets stored with prompt, provider and model recorded
- [ ] A visible spend counter — you should always know what you've spent

---

## Phase 10 — YouTube

> Verify current Google/YouTube API scopes and quotas first.

- [ ] Google OAuth with minimal scopes, localhost redirect
- [ ] Channel information and basic statistics
- [ ] Keep provider metrics identifiable; never invent a combined figure

---

## Beyond

**Phase 11 — Community:** chatbot, commands, timers, giveaways.
Architected for, not built until overlays and events are solid.

Monetization is out of scope — this is a personal tool, not a service.

---

## Not building

Multi-user accounts · hosting · billing · tips and payouts · merch · sponsor
marketplace · mobile apps · video editor · Figma-grade overlay editor · template
marketplace · custom arbitrary JavaScript widgets · AI co-host · AI moderation.
