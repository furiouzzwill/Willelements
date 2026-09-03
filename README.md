# Willelements

**An AI-native operating system for streamers and creators.**

> Build your brand. Power your stream. Grow your community.
>
> Your entire stream, built around your brand.

Willelements combines live-stream management, OBS overlays, branded alerts,
creator analytics and AI-assisted creation into one platform. The creator's
**Brand DNA** is the visual source of truth; their **connected platforms** are
the live-data source of truth.

---

## Current status

**Phase 1 — Foundation. Complete and validated.**

What works today:

- Next.js 16 App Router + TypeScript + Tailwind v4 UI foundation
- Supabase email/password authentication (sign up, confirm, sign in, sign out)
- Session refresh in `src/proxy.ts`, with signature-verified access tokens
- Protected application shell with the full product navigation
- Dashboard, account settings and security pages
- Public marketing landing page

What does **not** work yet — and is not pretended to:

- No Twitch or YouTube connection (Phase 4 / Phase 10)
- No overlays or OBS browser sources (Phase 5)
- No alerts (Phase 6), no live events (Phase 7)
- No AI generation (Phase 8 / Phase 9)
- No database tables beyond Supabase's own `auth` schema (Phase 2)

The dashboard renders **empty states rather than sample metrics**. Displaying a
number we did not receive from a provider is treated as a product bug.

See [`ROADMAP.md`](./ROADMAP.md) for the phase plan and
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for how the system fits together.

---

## Getting started

### Requirements

- Node.js **20.9+** (Next.js 16 requirement; developed on 22.x)
- npm 10+
- A Supabase project (free tier is fine)

### Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` from your Supabase project (**Project Settings → API keys**):

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`) |

Then:

```bash
npm run dev      # http://localhost:3000
```

Without those two variables the app still runs — it renders a setup notice on
the auth screens instead of crashing.

### Supabase project configuration

In **Authentication → URL Configuration**, add the callback URL so email
confirmation links work:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`

Add your production origin alongside these when you deploy.

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

## Project layout

```
src/
├── app/
│   ├── (auth)/            Sign in, sign up, confirm — public
│   ├── (app)/             Protected shell: dashboard, settings
│   ├── auth/callback/     OAuth / email confirmation code exchange
│   ├── layout.tsx         Root layout, fonts, metadata
│   └── page.tsx           Marketing landing (static)
├── components/
│   ├── shell/             Sidebar, topbar, page header
│   └── ui/                Button, field, panel, icons
├── config/navigation.ts   Product information architecture
├── lib/
│   ├── auth/dal.ts        Data access layer — the real authorisation check
│   ├── supabase/          Browser, server, admin clients + session refresh
│   ├── env.ts             Validated environment configuration
│   └── utils.ts
└── proxy.ts               Session refresh + optimistic redirects
```

Directories that arrive in later phases — `src/services/`, `src/app/overlay/`,
`supabase/migrations/` — are described in `ARCHITECTURE.md`.

---

## Security posture

Non-negotiables, enforced from Phase 1 onward:

- No secret ever reaches the browser. Server-only modules import `server-only`
  so a mistaken client import fails the build.
- Authorisation is decided server-side in the data access layer and by Postgres
  Row Level Security — never by the proxy redirect alone.
- Access tokens are validated by signature (`getClaims()`), never trusted
  straight from cookie storage.
- Auth responses are sent `Cache-Control: no-store` so no CDN can serve one
  creator's session to another.
- OBS browser-source URLs will carry opaque, revocable tokens — never user IDs,
  never OAuth tokens.

See [`docs/deployment.md`](./docs/deployment.md) for the full variable list.

---

## Documentation

| Document | Contents |
| --- | --- |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System design, service boundaries, architecture review |
| [`ROADMAP.md`](./ROADMAP.md) | Phases 1–10 with an implementation checklist |
| [`docs/brand-dna.md`](./docs/brand-dna.md) | The creator identity model |
| [`docs/overlay-system.md`](./docs/overlay-system.md) | Overlays, widgets, the OBS runtime |
| [`docs/event-system.md`](./docs/event-system.md) | Normalized events and the alert queue |
| [`docs/twitch-integration.md`](./docs/twitch-integration.md) | OAuth and EventSub plan |
| [`docs/youtube-integration.md`](./docs/youtube-integration.md) | YouTube/Google plan |
| [`docs/hyperframes.md`](./docs/hyperframes.md) | Motion generation and rendering |
| [`docs/ai-generation.md`](./docs/ai-generation.md) | Image generation and structured specs |
| [`docs/deployment.md`](./docs/deployment.md) | Vercel, Supabase, environment variables |
