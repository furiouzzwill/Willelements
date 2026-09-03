# Roadmap

Each phase is focused, testable, secure and shippable. A phase is not complete
until typecheck, lint and build all pass and the phase's own exit criteria are
demonstrably met.

**Current position: Phase 1 complete.**

---

## The first major milestone

Phases 1–7 exist to make exactly this work, end to end, for a real creator:

1. Open the web app → 2. Create an account → 3. Create their brand →
4. Upload a logo → 5. Connect Twitch securely → 6. Create an overlay →
7. Configure a branded follower alert → 8. Copy the browser-source URL →
9. Paste it into OBS → 10. Trigger a test follower alert → 11. See it in OBS →
12. Receive a real Twitch event → 13. See it in the dashboard →
14. See the alert execute in OBS.

Until that is reliable, resist expanding into anything else.

---

## Phase 0 — Discovery ✅

- [x] Inspect repository (empty, no commits, remote configured)
- [x] Node 22.22.2, npm 10.9.7, pnpm/yarn/bun also present
- [x] git 2.43.0
- [x] **FFmpeg: not installed** (risk R2)
- [x] **HyperFrames skill: not installed; CLI not available** (risk R1)
- [x] Supabase CLI: not installed. Vercel CLI: not installed
- [x] No project environment variables set; no `.env` files present
- [x] Findings recorded in `ARCHITECTURE.md` §10

---

## Phase 1 — Foundation ✅

- [x] Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4
- [x] Design system tokens, kept separate from creator Brand DNA
- [x] UI primitives: button, field, panel, empty state, icons
- [x] Validated environment configuration (`src/lib/env.ts`)
- [x] Supabase browser / server / admin clients
- [x] Session refresh in `src/proxy.ts` (Next 16 renamed middleware → proxy)
- [x] Email/password sign up, email confirmation, sign in, sign out
- [x] Auth callback route with open-redirect protection
- [x] Data access layer (`requireUser()`) as the real authorisation check
- [x] Protected app shell with the full product navigation
- [x] Dashboard with honest empty states
- [x] Account and security settings pages
- [x] Marketing landing page (static, reads no session)
- [x] Typecheck, lint and production build all clean
- [x] Documentation set

**Not verified:** the live sign-up → confirm → sign-in round trip has not been
run against a real Supabase project, because no credentials were available in
the build environment. First task of Phase 2 is to run it.

---

## Phase 2 — Data model

- [ ] Adopt Supabase CLI; `supabase/migrations/` under version control
- [ ] `profiles`, with a trigger creating a row on `auth.users` insert
- [ ] `brands`, `connected_accounts`, `assets`
- [ ] `overlays`, `overlay_widgets`, `alert_configs`
- [ ] `stream_events`, unique on `(provider, provider_event_id)`
- [ ] RLS enabled on every table, default deny
- [ ] Ownership isolation test: creator A cannot read creator B's rows
- [ ] Generated database types wired into the Supabase clients
- [ ] Storage buckets and upload policies (size and MIME limits)

**Exit:** a second account provably cannot reach the first account's data.

---

## Phase 3 — Brand system

- [ ] Creator onboarding flow
- [ ] Brand DNA editor: identity, colours, typography, visual style, motion style
- [ ] Logo upload with validation; variants; primary selection
- [ ] Brand rules (prefer / avoid)
- [ ] Asset library with brand association
- [ ] Brand overview page

**Exit:** a creator saves a complete Brand DNA and it survives a reload.

---

## Phase 4 — Twitch connection

> Read the current official Twitch documentation first. Do not rely on
> remembered endpoints, scopes or event names.

- [ ] Confirm current OAuth flow, scopes and endpoints
- [ ] Server-side authorisation code flow, state in an HTTP-only cookie
- [ ] Encrypted token storage the publishable key cannot reach
- [ ] Token refresh
- [ ] Import channel information
- [ ] Connection status and disconnect
- [ ] Request the minimum scopes needed

**Exit:** a creator connects Twitch, sees their channel, and disconnects cleanly.
No token ever reaches the browser.

---

## Phase 5 — Overlay runtime

- [ ] `overlays` CRUD and overlay list
- [ ] Opaque `public_token`, rotatable from the UI
- [ ] `/overlay/[token]` route — transparent, minimal JS, no dashboard code
- [ ] Realtime subscription with reconnect and backoff
- [ ] Test-event receiver
- [ ] Copy browser-source URL

**Exit:** an OBS browser source displays a test alert sent from the dashboard.

---

## Phase 6 — Alert system

One alert type, done properly: **follower**.

- [ ] `alert_configs` editor: text template, duration, animation, sound
- [ ] Brand DNA drives the styling
- [ ] Live widget animation in the browser runtime — no render job
- [ ] Alert queue: sequence rapid events instead of overlapping them
- [ ] Test Alert button travelling the real pipeline
- [ ] Basic overlay editor: alert box, image/logo, text, position, size

**Exit:** a branded follower alert plays correctly in OBS, and five test events
in a row queue rather than collide.

---

## Phase 7 — Twitch events

- [ ] Confirm the current EventSub transport and subscription types
- [ ] Webhook route with signature verification and challenge handling
- [ ] Handle revocation notifications
- [ ] Deduplicate by `(provider, provider_event_id)`
- [ ] Normalize into the internal event shape
- [ ] Persist to `stream_events`
- [ ] Activity feed
- [ ] Realtime fan-out to the browser source
- [ ] Decide the local development strategy (tunnel or WebSocket) — risk R5

**Exit:** a real Twitch follow appears in the activity feed *and* plays the alert
in OBS. **This completes the first major milestone.**

---

## Phase 8 — HyperFrames

> **Blocked** until the HyperFrames skill and CLI are installed (risk R1), and
> FFmpeg is available on the render host (risk R2).

- [ ] Install and verify the skill; read it as the source of truth
- [ ] Convert Brand DNA into a HyperFrames visual identity
- [ ] Scaffold → build → lint → inspect → preview → fix → render
- [ ] Animated logo as the first composition
- [ ] `RenderService` with queued jobs and status polling
- [ ] Render worker, off Vercel
- [ ] Rendered output stored as an asset

**Do not** move live alerts onto pre-rendered video.

---

## Phase 9 — OpenAI images

> Verify the current image API, model names, sizes and response format first.

- [ ] `ImageGenerationService`, server-side only
- [ ] Logo concepts and stream backgrounds
- [ ] Brand DNA feeds the prompt
- [ ] Generated assets stored in the library with their prompt and provider
- [ ] Rate limiting and usage events — never an unrestricted expensive endpoint

---

## Phase 10 — YouTube

> Verify current Google/YouTube API scopes and quotas first. Account for
> production OAuth verification requirements.

- [ ] Google OAuth with minimal scopes
- [ ] Channel information and basic statistics
- [ ] Basic analytics
- [ ] Cross-platform audience view, keeping provider metrics identifiable

---

## Beyond

**Phase 11 — Community:** chatbot, commands, timers, moderation, giveaways,
loyalty. **Phase 12 — Monetization:** tips, goals, TTS, sponsors, entitlements
and billing.

Architected for from the start. Not built until overlays and events are solid.

---

## Explicitly not in the MVP

Full YouTube analytics · TikTok · chatbot · loyalty · giveaways · tips · merch ·
sponsor marketplace · mobile apps · video editor · Figma-grade overlay editor ·
template marketplace · agency teams · custom arbitrary JavaScript widgets ·
full stream package generator · advanced cross-platform analytics · AI co-host ·
AI moderation.
