# YouTube integration

**Status: planned (Phase 10). Not implemented. Do not start before Twitch is reliable.**

> ⚠️ **Read the current official documentation before writing any code**:
> <https://developers.google.com/youtube>
>
> Do not implement from remembered examples. Google's APIs, scopes, quotas and
> verification requirements change.

## Scope

Channel information, subscriber statistics, views, videos, live streams,
analytics and audience data — each only where the API and the creator's
authorisation actually provide it. Watch time and membership events only where
supported.

## OAuth

- Google OAuth, **minimum scopes**. Read-only wherever read-only will do.
- Server-side flow with `state` validation, same shape as Twitch.
- Tokens encrypted at rest, server-side only.

### Production verification

Google requires app verification for sensitive and restricted scopes. This is a
review process with real lead time, and it can require a security assessment.
Plan for it at the start of Phase 10, not at launch. Choosing narrower scopes
early is the cheapest way to reduce this burden.

## Quotas

The YouTube Data API is quota-limited per day, and different operations cost
different amounts. Cache aggressively, snapshot rather than re-query, and treat
quota as a design constraint from the first line of code.

## Events

YouTube's live event surface differs from Twitch's. Some things Twitch pushes,
YouTube requires polling for. The adapter absorbs that difference — the internal
event shape stays identical, so the activity feed, alert engine and overlay
runtime need no YouTube-specific code.

## Cross-platform analytics

Unify where the metrics genuinely mean the same thing. Keep raw provider metrics
identifiable. **Never invent a cross-platform figure** by combining numbers that
are not comparable — a YouTube subscriber and a Twitch follower are not the same
thing, and adding them produces a number that means nothing.
