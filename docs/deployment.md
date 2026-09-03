# Deployment

## Topology

```
Vercel                     Supabase                External
├── Marketing (static)     ├── PostgreSQL + RLS    ├── Twitch
├── Creator dashboard      ├── Auth                ├── YouTube
├── Overlay editor         ├── Storage             └── OpenAI
├── OBS browser routes     └── Realtime
└── Web APIs
                           Render worker (off Vercel)
                           └── HyperFrames + FFmpeg
```

Everything request-shaped runs on Vercel. Video rendering does not — see
`ARCHITECTURE.md` §8.

## Environment variables

### Required now (Phase 1)

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | `sb_publishable_…`. Safe to expose; RLS-guarded |
| `NEXT_PUBLIC_SITE_URL` | Public | Absolute origin. Optional on Vercel |

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is still accepted as a fallback, but Supabase is
retiring the legacy `anon` and `service_role` keys — prefer the new names.

### Server-only — never `NEXT_PUBLIC_`, never logged

| Variable | Phase | Notes |
| --- | --- | --- |
| `SUPABASE_SECRET_KEY` | 7 | `sb_secret_…`. Bypasses RLS. Webhooks and workers only |
| `TWITCH_CLIENT_ID` | 4 | |
| `TWITCH_CLIENT_SECRET` | 4 | |
| `TWITCH_EVENTSUB_SECRET` | 7 | Webhook signature verification |
| `OPENAI_API_KEY` | 9 | |
| `GOOGLE_CLIENT_ID` | 10 | |
| `GOOGLE_CLIENT_SECRET` | 10 | |

`SUPABASE_SERVICE_ROLE_KEY` is accepted as a legacy fallback for
`SUPABASE_SECRET_KEY`.

## Vercel setup

1. Import the repository.
2. Framework preset: **Next.js**. Node **20.9+**. Build and output settings are
   detected automatically.
3. Add the environment variables for every environment you use (Production,
   Preview, Development). Public variables are inlined at build time, so a
   change to one needs a redeploy, not just a restart.
4. `NEXT_PUBLIC_SITE_URL` may be omitted — the app falls back to
   `VERCEL_PROJECT_PRODUCTION_URL`.

## Supabase setup

1. Create the project and copy the URL and publishable key.
2. **Authentication → URL Configuration**: set the Site URL and add
   `<origin>/auth/callback` to the redirect allow-list, for every origin you use
   including preview deployments.
3. From Phase 2, apply migrations from `supabase/migrations/` and confirm RLS is
   enabled on every table before shipping.

## Runtime notes

- `src/proxy.ts` runs on application routes only. The OBS browser-source routes
  and webhook endpoints are deliberately excluded — a browser source must not
  pay for a session refresh, and a webhook has no session.
- Pages under `(app)` are `force-dynamic`: per-creator, never cached, never
  prerendered.
- Auth responses carry `Cache-Control: no-store`, so no CDN can serve one
  creator's session to another.
- The marketing page reads no session and must stay that way to remain static.

## Pre-deploy checklist

- [ ] `npm run check` passes (typecheck + lint)
- [ ] `npm run build` passes
- [ ] No secret is exposed through a `NEXT_PUBLIC_` variable
- [ ] Supabase redirect URLs include this deployment's origin
- [ ] RLS enabled on every table (from Phase 2)
- [ ] No token or secret appears in any log line
