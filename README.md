# Willelements

**A local, AI-native streaming toolkit — overlays, alerts, brand and analytics, running on your own machine.**

> Build your brand. Power your stream.

Willelements runs entirely on your computer. No account, no server, no
subscription. Your Brand DNA is the visual source of truth; your connected
streaming platform is the live-data source of truth. Everything is stored in a
single folder you own.

---

## Current status

**Phase 1 — Foundation. Complete and validated.**

Working today:

- Next.js 16 App Router + TypeScript + Tailwind v4
- Local SQLite database, created and migrated automatically on first run
- Full schema: brands, assets, overlays, widgets, alert configs, connected
  accounts, stream events
- Application shell with the full product navigation
- Dashboard with a live setup checklist read from the database
- Storage settings showing exactly where your data lives

Not working yet — and not pretended to:

- No Twitch connection (Phase 4)
- No overlays or OBS browser sources (Phase 5)
- No alerts (Phase 6), no live events (Phase 7)
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
| `npm run check` | Typecheck + lint — run before every commit |

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
└── lib/
    ├── db/                SQLite connection, schema, migrations
    ├── services/          Brand, setup — feature logic lives here
    ├── env.ts             Optional configuration
    └── utils.ts
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
