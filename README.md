# Willelements

**A local, AI-native streaming toolkit — overlays, alerts, brand and analytics, running on your own machine.**

> Build your brand. Power your stream.

Willelements runs entirely on your computer. No account, no server, no
subscription. Your Brand DNA is the visual source of truth; your connected
streaming platform is the live-data source of truth. Everything is stored in a
single folder you own.

---

## Current status

**Phase 7 — Twitch events. Complete, pending a live connection.**

Working today:

- Next.js 16 App Router + TypeScript + Tailwind v4
- Local SQLite database, created, migrated and seeded automatically on first run
- Full schema: brands, assets, overlays, widgets, alert configs, connected
  accounts, stream events
- Validated Brand DNA, alert specs, widget configs and events — every JSON
  column is schema-checked on the way in and out
- **Brand Studio** — identity, colours, typography, visual and motion style, and
  brand rules, with a live preview of how a follower alert will look
- **Logo upload** and an asset library, with files identified by content rather
  than by name
- First-run onboarding
- **Twitch connection** — OAuth with encrypted token storage, automatic refresh,
  and live status, follower count and recent follows on the dashboard
- **OBS overlays** — transparent browser sources on rotatable opaque URLs, fed
  by Server-Sent Events, with alerts that queue rather than overlap and test
  events that travel the real pipeline
- **Configurable alerts** for every event type — label, message template,
  duration, animations, sound, volume and minimum thresholds, all styled from
  your Brand DNA and previewed with the exact renderer OBS uses
- **Live Twitch events** over EventSub WebSocket — follows, raids, subs, gift
  subs, cheers and stream online/offline, normalized, deduplicated, recorded and
  pushed straight to your overlay
- **Activity feed** with live connection status
- One-click backup and restore of everything you have
- Application shell with the full product navigation
- Dashboard with a live setup checklist read from the database
- 160 tests, no test dependencies

Not working yet — and not pretended to:

- No overlay editor or widgets beyond alerts (Phase 8)
- No analytics pages yet (Phase 10)
- No AI generation (Phase 8 / 9)
- No AI generation (Phase 8 / 9)

The dashboard shows **empty states rather than sample metrics**. Displaying a
number no provider actually gave us is treated as a bug.

---

## Getting started

Requires **Node.js 20.9+** (developed on 22.x). Nothing else.

```bash
npm install
npm run dev      # http://localhost:3000
```

That's it. No `.env` file needed, no account to create, no service to sign up
for. The database is created on first page load.

Copy `.env.example` to `.env.local` only when you reach a phase that needs a
provider key — none are required to run the app.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Run the test suite |
| `npm run check` | Typecheck + lint + tests — run before every commit |

---

## Your data

Everything lives in one directory:

```
data/
├── app.db          SQLite database
└── assets/         Uploaded and generated files
```

- **Back up** by copying that folder.
- **Move machines** by copying that folder.
- **Start over** by deleting it — it is recreated on next run.
- It is gitignored. It is yours, not the project's.

Point `WILLELEMENTS_DATA_DIR` somewhere else if you'd rather keep it outside
the repo.

---

## What it costs

Nothing, for everything through Phase 7 — a working branded follower alert in
OBS driven by real Twitch events.

| | Cost |
| --- | --- |
| SQLite, local files | Free |
| Twitch API + EventSub | Free |
| OBS | Free |
| Running the app | Free |
| OpenAI image generation (Phase 9) | Pay per image — optional, and far away |

---

## Project layout

```
src/
├── app/
│   ├── (app)/             Dashboard, settings — the application shell
│   ├── layout.tsx         Root layout, fonts, metadata
│   └── page.tsx           Redirects to the dashboard
├── components/
│   ├── shell/             Sidebar, topbar, page header
│   └── ui/                Button, field, panel, icons
├── config/navigation.ts   Product information architecture
├── lib/
│   ├── db/                SQLite connection, schema, migrations, JSON helpers
│   ├── schemas/           Zod schemas for every JSON column
│   ├── services/          Brand, asset, backup, setup — feature logic
│   ├── env.ts             Optional configuration
│   └── utils.ts
└── ...
tests/                     node:test suites
```

Later phases add `src/app/overlay/` (the OBS browser sources) and more services.

---

## Documentation

| Document | Contents |
| --- | --- |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System design and architecture review |
| [`ROADMAP.md`](./ROADMAP.md) | Phases 1–10 with an implementation checklist |
| [`docs/local-setup.md`](./docs/local-setup.md) | Running it, backing it up, OBS |
| [`docs/brand-dna.md`](./docs/brand-dna.md) | The creator identity model |
| [`docs/overlay-system.md`](./docs/overlay-system.md) | Overlays, widgets, the OBS runtime |
| [`docs/event-system.md`](./docs/event-system.md) | Normalized events and the alert queue |
| [`docs/twitch-integration.md`](./docs/twitch-integration.md) | OAuth and EventSub plan |
| [`docs/youtube-integration.md`](./docs/youtube-integration.md) | YouTube/Google plan |
| [`docs/hyperframes.md`](./docs/hyperframes.md) | Motion generation and rendering |
| [`docs/ai-generation.md`](./docs/ai-generation.md) | Image generation and structured specs |
