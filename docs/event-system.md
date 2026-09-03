# Event system

**Status: planned (Phase 7). Not implemented.**

## Internal event shape

Every provider event is normalized into one format before anything else sees it.

```json
{
  "type": "channel.follow",
  "provider": "twitch",
  "creatorId": "uuid",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "actor": { "id": "provider-id", "displayName": "ViewerName" },
  "data": {},
  "isTest": false
}
```

Planned types: follow, subscribe, gift subscription, raid, cheer, tip,
membership, stream online, stream offline. Only what a provider actually
supports gets implemented.

## Pipeline

```
Provider ──▶ Adapter ──▶ Normalized event ──▶ EventService
                                                  ├─▶ Activity Feed
                                                  ├─▶ Analytics
                                                  ├─▶ Alert Engine
                                                  └─▶ Realtime → OBS
```

The adapter is the only code that knows a provider's vocabulary. Everything
downstream is provider-neutral — which is what stops the whole application from
quietly becoming Twitch-specific.

## Reliability

Streamers depend on this while live, so:

- **Idempotency.** A unique constraint on `(provider, provider_event_id)`.
  Providers may deliver the same event more than once; the database rejects the
  duplicate rather than the application trying to remember.
- **Signature verification.** Every webhook is verified before it is trusted.
  An unverified request is discarded, not processed.
- **Reconnect.** Realtime subscribers reconnect with backoff.
- **Queueing.** Alerts sequence rather than overlap.
- **Graceful degradation.** A provider outage stops new events. It must not take
  down the overlay, the dashboard, or the alerts already queued.

## Alert queue

Five events can land in two seconds. They must not all play at once.

```
Incoming events
      ▼
Eligibility / rules      (enabled? threshold met? not filtered?)
      ▼
Alert queue
      ▼
Current alert ──▶ animation ──▶ complete ──▶ next
```

Not overbuilt in early development — but never architected as though only one
event can ever arrive at a time.

## Test events

A creator must be able to preview their setup without waiting for a real
follower. Test events enter the pipeline as normalized events with
`isTest: true` and travel the same path as real ones: same rules, same queue,
same animation, same browser source.

They are flagged internally so they never pollute analytics.
