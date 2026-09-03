# Twitch integration

**Status: planned (Phase 4 connection, Phase 7 events). Not implemented.**

> ⚠️ **Read the current official documentation before writing any code**:
> <https://dev.twitch.tv/docs/>
>
> Endpoints, OAuth scopes and event names change. `channel.follow` in particular
> has changed its authorisation requirements in the past. Nothing in this
> document is verified API behaviour — it is a plan.

## Scope of work

**Phase 4 — connection.** Account connection, channel information, stream
status, connection management.

**Phase 7 — events.** Follows, subscriptions, raids, cheers, stream
online/offline; activity feed and alert triggers.

Later, and only where the API and the creator's authorisation allow: subscriber
counts, channel statistics, recent stream information.

## OAuth

Authorisation code flow, entirely server-side.

- `state` generated per attempt, stored in an HTTP-only cookie, compared on
  return. A mismatch aborts the flow.
- Tokens exchanged server-side. The client never sees the code or the tokens.
- Access and refresh tokens encrypted at rest, in a table the publishable key
  cannot reach.
- Refresh handled server-side, ahead of expiry.
- **Request the minimum scopes.** Each additional scope needs a reason a creator
  would accept if asked.

Never log a token. Never put one in a redirect URL, an error message, or an OBS
browser-source URL.

## EventSub

Twitch supports three transports — **webhook**, **WebSocket** and **conduits**.
Subscriptions are transport-agnostic. The plan is webhooks in production, since
this is a serverless deployment with no long-lived process.

Confirm at implementation time, from the official docs:

- [ ] Current webhook signature header names and the exact signing algorithm
- [ ] Challenge verification handshake for new subscriptions
- [ ] Revocation notification handling
- [ ] Retry and duplicate-delivery behaviour
- [ ] Subscription limits and cost accounting
- [ ] The current version and authorisation requirement of each subscription type

### Webhook route requirements

- Public HTTPS endpoint (`/api/webhooks/twitch`), excluded from the proxy matcher.
- Verify the signature **before** parsing or acting on the body.
- Respond quickly; do the work after acknowledging.
- Deduplicate on the message/event ID.
- Handle challenge and revocation message types, not just notifications.

### Local development (risk R5)

Local machines have no public HTTPS URL, so webhooks cannot arrive directly.
Phase 7 must pick one deliberately: a tunnel to the local server, or the
WebSocket transport for development only. Decide it at the start of the phase,
not when it blocks.

## Data retention (risk R7)

Check the Twitch developer terms before storing provider-derived data
indefinitely. Snapshots are needed to show history without hammering the API,
but what may be retained, and for how long, is set by their terms — not by our
convenience.
