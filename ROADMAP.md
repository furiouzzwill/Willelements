# Roadmap

Each phase is focused, testable and shippable. A phase is not complete until
typecheck, lint and build all pass and its exit criteria are demonstrably met.

**Current position: Phase 9 complete. Twitch is connected to a real channel and
an overlay has run live on an actual stream.**

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
- [x] **FFmpeg: not installed** (risk R2 — resolved in Phase 9)
- [x] **HyperFrames skill and CLI: not available** (risk R1 — resolved in Phase 9)
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

## Phase 7 — Twitch events ✅ (connected; one claim still unobserved)

Protocol verified against the official docs before writing any code:

- `wss://eventsub.wss.twitch.tv/ws`, keepalive 10–600s
- Subscriptions must be created within **10 seconds** of the welcome message or
  Twitch closes the connection
- On `session_reconnect`, connect to the new URL and do **not** close the old
  socket until the replacement sends its own welcome
- `channel.follow` is **v2** and needs both `broadcaster_user_id` and
  `moderator_user_id`
- Raids and stream online/offline need **no scope at all**

- [x] EventSub WebSocket client: welcome, keepalive, notification, reconnect
      and revocation, all handled
- [x] Subscriptions created together on welcome, inside the 10s window
- [x] Silence watchdog — a socket can stay open while the connection behind it
      is gone, which is what a laptop waking from sleep looks like
- [x] Reconnect with exponential backoff capped at a minute
- [x] Normalization into the provider-neutral shape; unknown types skipped
      rather than stored half-understood
- [x] Persisted to `stream_events`, deduplicated by the unique constraint —
      replaying an alert for a follow that already fired is worse than dropping
      it
- [x] Activity feed, with test events recorded but excluded by default
- [x] Live connection status in the UI
- [x] Scopes derived from the subscriptions, so the consent screen and the
      feature set cannot drift apart; a token that predates a scope degrades
      gracefully and the UI says exactly what reconnecting would add
- [x] Listener started from `instrumentation.ts` on server boot, and restarted
      when an account is connected or disconnected

**Proven:** Twitch-shaped payload → normalize → record → dedupe → publish →
OBS → branded alert. Verified in tests with real EventSub payload shapes, and
in a browser: fired a raid, watched "SynthFox raided with 150" render in the
overlay, confirmed it was recorded, excluded from the real feed, visible and
marked when tests are shown, and cleared on request.

**Connected.** A registered Twitch app is authorised against a real channel.
Tokens encrypt, store and decrypt; the REST path answers with channel identity,
live status, follower count and recent follows, and the dashboard reads them.

**Still unobserved:** the EventSub WebSocket carrying a genuine Twitch event.
The connection exists, but no real follow, raid, sub or `stream.online` has been
watched arriving over the socket and firing an alert. Everything either side of
it is proven — test events travel the same `recordEvent` path and render in a
live overlay — so this is one link in a chain whose every other link is
demonstrated. It closes the first time a real event lands in the activity feed.

Test events now go through `recordEvent`, the same door a real event uses, so a
passing test genuinely exercises the real path rather than a shortcut past it.

---

## Phase 8 — Overlay editor and widgets ✅

HyperFrames was the original Phase 8, but at the time it was blocked — no skill,
no CLI, no FFmpeg. The overlay editor was unblocked and worth more, so it took
this slot; HyperFrames moved to Phase 9 and shipped there.

- [x] Eight widget types: alert box, text, image, latest follower, latest
      subscriber, recent events, follower goal, clock
- [x] Editor with drag, resize from any corner, layer reordering, lock,
      duplicate, delete and a per-type properties panel
- [x] Positions stored in **canvas pixels**, not percentages, so an overlay
      built for 1920×1080 lands identically in OBS regardless of the size the
      editor happened to be displayed at
- [x] Drag tracked locally at pointer speed and written once on release —
      saving on every pointer move would be hundreds of writes per drag
- [x] **One widget renderer** shared by the editor and the runtime, so the
      editor cannot show you something different from what goes on stream
- [x] The alert box positions alerts rather than drawing anything: visible in
      the editor, invisible on stream
- [x] Widgets update live from the same event stream that drives alerts — a
      "latest follower" widget changes the moment the alert plays, with no
      polling and no second connection
- [x] Widget values update even when the matching alert is disabled

**Exit met**, verified in a browser: placed three widgets, dragged one 161px and
confirmed the position survived a reload, edited a label through the properties
panel, then opened the overlay URL and confirmed the same widgets rendered with
the custom label, that the alert box was invisible on stream, and that firing a
follow updated the latest-follower widget live.

Three things this phase found:
- The properties panel's labels were not bound to their inputs, so a screen
  reader announced the controls with no name.
- The palette and the layers list had buttons with identical visible text, so
  neither could be told apart by name.
- The overlay preview iframe declared `allow-scripts allow-same-origin`, a
  combination the browser correctly warns is equivalent to no sandbox at all.
  Claiming a sandbox that does nothing is worse than not claiming one.

---

## Phase 9 — HyperFrames ✅

Unblocked: the official skills are installed from `heygen-com/hyperframes` and
pinned in `skills-lock.json`, FFmpeg is present, and the CLI fetches its own
headless Chrome. Risks R1 and R2 are resolved. The skills' own documentation was
read first and drove the composition contract.

- [x] Brand DNA → a visual identity: durations, easings, travel, stagger,
      typography and a contrast-corrected palette, in **one** module that every
      template reads instead of interpreting the DNA itself
- [x] **Animated logo** as the first composition, plus a looping scene card and
      a transparent lower third
- [x] Templates are **pure functions** from identity to HTML string, so the
      exact file the renderer will open is asserted in unit tests rather than
      discovered to be wrong after a two-minute render
- [x] GSAP **vendored**, never a CDN — with a test that fails on any URL in a
      generated composition
- [x] Background render jobs: `render_jobs`, a single-worker queue, the CLI's own
      progress parsed into the row, live status in the UI without blocking it
- [x] Rendered output stored in `data/assets`, projects kept under `data/renders`
- [x] Toolchain probe that says exactly what is missing instead of offering a
      Render button that fails
- [x] Interrupted renders closed out at boot
- [x] Byte-range support on the asset route, so a rendered video can be scrubbed

**Exit met**, verified by driving the real UI in a browser on a clean data
folder. Rendered all three compositions, watched progress move without a reload,
and checked what came out:

- The lower third decodes at 1920×1080 with **genuine transparency** — alpha 0
  across the frame, 239 inside the bar.
- The scene card is exactly 240 frames at 30fps, and the seam holds: the last
  frame differs from the first by about as much as any two adjacent frames
  (0.37 against 0.28 mean absolute difference), so the loop continues rather
  than jumps.
- The asset route answers a range request with a 206 and a correct
  `Content-Range`, so the scrubber works.
- Zero page errors throughout.

Live alerts were **not** moved onto pre-rendered video, and the animations page
says why in as many words.

**Added later: an `alert-sting` composition.** A transparent backdrop that plays
*behind* a live alert — rendered once, reused for every event, with the username
staying live DOM on top. That keeps the rule intact (no event ever goes through
a render job) while giving alerts real motion graphics. It is the only template
with no text fields at all, and a test enforces that: one video is reused for
every viewer, so a name baked into it would be the wrong name for everyone but
the first.

Two things were only found by rendering it and looking:

- Sparks were offset by `motion.travel` — tens of pixels — and landed in the
  middle of a 1920-wide frame, on top of the alert's own text. They are anchored
  to the ring's geometry now, and a test checks they stay outside it at every
  brand energy.
- The first version left the centre genuinely empty, on the theory that a
  backdrop should not compete with the words. Over dark gameplay that was
  invisible, and white text on unknown footage has no guaranteed contrast. The
  middle now carries a dark plate the ring frames — the same reasoning the
  banner alert layout already used.

Still to do: choosing a rendered backdrop on an alert. The composition exists
and renders; attaching one to an alert config is the next step.

Things worth recording from this phase:

- The first render failed on a navigation timeout because the composition loaded
  GSAP from a CDN. Vendoring it fixed it and removed a network dependency from
  every future render.
- `ensureContrast` replaced a maximise-contrast rule that was quietly swapping a
  brand's considered near-black ink for pure black on every light palette.
- Text on the mark sits on a two-colour gradient, so its contrast is now chosen
  against **both** ends rather than the one the gradient starts at.
- `pix_fmt` reads `yuv420p` for a transparent VP9 WebM — the alpha rides as
  Matroska side data, not in the pixel format. Judging transparency by `ffprobe`
  alone would have condemned a file that is genuinely transparent.
- The asset route ignored `Range`, which nothing noticed until there was a video
  to scrub.

---

## Phase 10 — OpenAI images ✅ (AI Create and Stream Packages)

> **This is the only part of the project that costs money.**

The API was verified before any code was written, and it mattered: the obvious
default, `gpt-image-1`, **retires on 2026-10-23**. Building on it would have
shipped something with weeks to live. `gpt-image-1.5` is the default instead.

- [x] Image generation server-side only, as a single `fetch` — no SDK, in
      keeping with the CLI and GSAP decisions elsewhere
- [x] Logo concepts, stream backgrounds, channel panels and offline cards
- [x] Brand DNA feeds the prompt through **one** module, so two subjects cannot
      disagree about what "luxury" means — the same argument as `identity.ts`
- [x] Assets stored with prompt, provider and model recorded, so a result you
      liked can be reproduced
- [x] **A visible spend counter**, and honest about what it is
- [x] **Stream package** — all four pieces from one press, generated
      sequentially so a rate limit stops at a known point rather than leaving an
      arbitrary paid-for subset
- [x] 15 tests over pricing and prompt construction
- [ ] Graphics, Social Content, Templates and Notifications — the rest of this
      phase's navigation, still locked

**The spend counter is an estimate, and says so.** It is computed from a price
list read on a date; it cannot see credits, discounts, tax or tier. Presenting
that as a billed figure would be inventing a number no provider gave us, which
is the failure this project cares most about. So the page carries the word
estimate, the date, and a pointer to OpenAI's dashboard as the authority.

Three consequences of taking that seriously:

- A model with no verifiable published price estimates **null, never zero**.
  Zero claims the call was free; null says we do not know. Unpriced generations
  are counted beside the total rather than folded into it.
- A **failed** generation records a null cost, not zero — it was not charged,
  and the row exists to explain the history rather than to bill it.
- The generation row is written **after** the provider answers. A row written
  first would have to be un-written on failure, and a crash between the two
  would record a charge that never happened.

Spend history lives in its own table rather than on the asset. A refused prompt
produces no asset, and deleting a picture must not erase the record that it was
paid for — a counter that reset when you tidied your library would be worse
than none.

**Caught by checking the arithmetic:** the package form first quoted one size
times four. The four pieces are two square and two wide, which are not priced
alike, so it overstated a medium package by 18% ($0.20 against $0.17). The form
now takes the real list of sizes.

**Verified end to end**, with a real key and real money. One logo concept on
`gpt-image-1-mini` at low quality — the cheapest combination available, $0.005:

- The call succeeded and returned base64, decoded to a 1024×1024 PNG
- **Genuinely transparent**: 88.7% of the frame at alpha 0, corner at 0
- **No lettering**, so the instruction against it held — image models add
  garbled text otherwise, which makes a logo unusable
- The brand's own palette came through: the mark is the brand purple with the
  cyan accent, neither of which was named as a word
- Saved as an asset with `type: logo`, prompt, provider and model recorded
- Spend recorded exactly once: `{"total":0.005,"succeededCount":1}`

**Caught by that first real run:** `ImageProviderError` used a TypeScript
constructor parameter property. That is syntax rather than a type, so Node's
strip-only mode cannot load it — and this project's entire test harness runs on
Node's stripping. `next build` compiles with SWC and accepted it silently, so
nothing failed until something imported the module at runtime. `TwitchApiError`
already avoided this; the class now matches, and a test imports the module so
the harness catches a recurrence rather than a person does.

---

## Phase 11 — Analytics and YouTube

### Analytics ✅ (brought forward)

Pulled ahead of the rest of Phase 11 because it needed no new provider
credentials — every figure is counted from events already in `stream_events` —
and there was finally real activity to read.

- [x] `analyticsSummary`, `streamsReport`, `audienceReport`, all counted from
      recorded events rather than modelled
- [x] **Test events never count.** The exclusion is in the query, not in a
      caller that might forget it
- [x] Providers stay separate — a combined follower total would be a number
      neither provider agrees with, so the Twitch page scopes to `twitch` and
      says why its two follower figures differ
- [x] **Overview** — totals, events per day, breakdown by type
- [x] **Twitch** — channel figures from the API beside events we recorded,
      labelled as the different things they are
- [x] **Streams** — sessions rebuilt by pairing `stream.online` with the next
      `stream.offline`, tolerating a missing half on either side
- [x] **Audience** — top cheerers, raiders and gifters, grouped by actor id so
      a rename does not split someone in two
- [x] Empty states rather than zeros when nothing has been recorded
- [x] Charts as inline SVG — no chart dependency added; quiet days render as
      zero columns rather than being dropped
- [x] 18 tests over the aggregation rules

**Proven:** seeded a throwaway database with three streams' worth of events plus
one test event carrying 999,999 bits, then read every page. The test event
appears in no total. Bits, raid viewers and gifted subs each match the sum of
their events. The open stream shows `Live now` with an unknown length rather
than a duration measured against the clock.

Two layout bugs were found by screenshotting the pages rather than by the
tests: colliding axis labels at the right edge, and a short panel stretched to
match a tall one beside it. Both are fixed. Neither was visible from a passing
test suite, which is the argument for looking at the thing.

### YouTube

> Verify current Google/YouTube API scopes and quotas first.

- [ ] Google OAuth with minimal scopes, localhost redirect
- [ ] Channel information and basic statistics
- [ ] Keep provider metrics identifiable; never invent a combined figure
- [ ] Goals, Labels and the OBS integration — the rest of this phase's
      navigation, still locked

---

## Beyond

**Phase 12 — Community:** chatbot, commands, timers, giveaways.
Architected for, not built until overlays and events are solid.

Monetization is out of scope — this is a personal tool, not a service.

---

## Not building

Multi-user accounts · hosting · billing · tips and payouts · merch · sponsor
marketplace · mobile apps · video editor · Figma-grade overlay editor · template
marketplace · custom arbitrary JavaScript widgets · AI co-host · AI moderation.
