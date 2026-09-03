# Twitch integration

**Status: connection implemented (Phase 4). Events planned (Phase 7).**

> ⚠️ **Read the current official documentation before writing any code**:
> <https://dev.twitch.tv/docs/>
>
> Endpoints, OAuth scopes and event names change. The Phase 4 sections below
> were verified against the official docs at implementation time; the Phase 7
> sections are still a plan and must be re-checked before they are built.

## Setting it up

1. Register an app at <https://dev.twitch.tv/console/apps/create>
2. OAuth Redirect URL: `http://localhost:3000/api/twitch/callback` — Twitch
   matches this character for character, so a trailing slash or a different port
   will fail
3. Client Type: **Confidential**
4. Put the Client ID and Secret in `.env.local` as `TWITCH_CLIENT_ID` and
   `TWITCH_CLIENT_SECRET`, then restart

The app shows these same steps at `/integrations/twitch` when credentials are
missing.

## What was verified

| Thing | Detail |
| --- | --- |
| Authorize | `https://id.twitch.tv/oauth2/authorize` — client_id, response_type=code, redirect_uri, space-delimited scope, state |
| Token | `POST https://id.twitch.tv/oauth2/token` form-encoded, grant_type=authorization_code |
| Refresh | Same URL, grant_type=refresh_token. **Returns a new refresh token** |
| Revoke | `POST https://id.twitch.tv/oauth2/revoke` — client_id, token |
| Helix auth | `Authorization: Bearer <token>` plus `Client-Id` |
| localhost | `http://localhost:PORT` redirects are permitted |

**The refresh token rotates.** This is the detail most likely to be missed:
persisting the token we sent rather than the one returned works exactly once,
and then the connection fails with nothing obvious to point at.

Refresh tokens for confidential clients do not expire on a timer, but are
invalidated when the user changes their password or disconnects the app. A 401
on refresh means re-authorisation, which the UI surfaces as "reconnect".

## Scope of work

**Phase 4 — connection.** Account connection, channel information, stream
status, connection management.

**Phase 7 — events.** Follows, subscriptions, raids, cheers, stream
online/offline; activity feed and alert triggers.

Later, and only where the API and the creator's authorisation allow: subscriber
counts, channel statistics, recent stream information.

## OAuth

Authorisation code flow, handled entirely by the local server.

- Redirect URL is a loopback address: `http://localhost:3000/api/twitch/callback`.
  Twitch permits localhost redirects, which is what makes this work without any
  public hosting.
- `state` generated per attempt, stored server-side, compared on return. A
  mismatch aborts the flow.
- Tokens exchanged server-side. The browser never sees the code or the tokens.
- Access and refresh tokens **encrypted before they are written** to
  `connected_accounts`, so a copied `app.db` is not usable on its own.
- Refresh handled ahead of expiry.
- **Request the minimum scopes.** Following alerts need
  `moderator:read:followers`; confirm the current requirement rather than
  assuming this one.

Never log a token. Never put one in a redirect URL, an error message, or an OBS
browser-source URL.

## EventSub — WebSocket transport

Twitch supports three transports: **webhook**, **WebSocket** and **conduits**.
Subscriptions are transport-agnostic, so the choice is purely operational.

**This app uses the WebSocket transport**, and that is the right call for a
local application. Webhooks need a public HTTPS URL that a machine on a home
network does not have; using them would mean running a tunnel and depending on
it while live. With WebSocket the app dials out to Twitch and receives events on
that connection — no inbound port, no tunnel, no certificate.

Confirm at implementation time, from the official docs:

- [ ] Current WebSocket endpoint URL
- [ ] The welcome / keepalive / reconnect / revocation message types
- [ ] How session IDs are issued and attached to subscriptions
- [ ] Keepalive timeout, and how long a reconnect URL stays valid
- [ ] Subscription limits per session
- [ ] The current version and authorisation requirement of each subscription type

### Client requirements

- Connect, read the welcome message, and use its session ID when creating
  subscriptions via the Helix API.
- Respond to **reconnect** messages by connecting to the supplied URL before
  dropping the old socket, so no events are missed in the gap.
- Treat a missed keepalive as a dead connection and reconnect with backoff.
- Handle **revocation** — a subscription can be revoked when authorisation is
  withdrawn or the app's permissions change.
- Deduplicate on the message ID. Twitch may redeliver; the unique constraint on
  `stream_events` is the backstop.

### Reconnect behaviour matters more than it looks

This connection is the difference between alerts working and not working during
a stream. It has to survive a laptop sleeping, a router blip and a Twitch-side
reconnect instruction, and it has to be visible in the UI when it is down — a
silently dead socket looks identical to a quiet stream.

## Data retention

Everything is stored locally, on the streamer's own machine, about their own
channel — which is a materially different position from a service warehousing
other people's data. Still worth reading the Twitch developer terms before
building long-term analytics snapshots in Phase 7.
