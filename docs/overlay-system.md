# Overlay system

**Status: planned (Phase 5–6). Not implemented.**

## Model

```
overlay
 ├── canvas      { width, height }   1920×1080 and 1280×720 first; vertical later
 ├── settings    { background, scale, … }
 └── widgets[]   { type, config, x, y, width, height, zIndex, locked }
```

Widgets come from a registry so new types can be added without touching the
runtime. Planned types: Alert Box, Webcam Frame, Text, Image, Video, Chat,
Latest Follower, Latest Subscriber, Recent Events, Follower Goal, Subscriber
Goal, Donation Goal, Countdown, Clock, Social Rotator, Viewer Count, Stream
Labels, Media. MVP ships Alert Box, Image/logo and Text.

## The OBS browser source

```
https://<app-origin>/overlay/{publicToken}
```

Rules for this route, which override editor convenience every time:

- Transparent background, no dashboard chrome, no application shell.
- Minimal JavaScript. Nothing from the editor bundle reaches it.
- Realtime connection with automatic reconnect and backoff.
- Recovers gracefully after a disconnect — a browser source may sit untouched in
  OBS for weeks.
- Excluded from the proxy matcher: no session cookie, no session refresh.

A beautiful editor is worthless if the resulting overlay stutters on stream.

## Security

- `publicToken` is opaque and unrelated to the overlay's UUID or the creator's
  ID. It is not sequential and not guessable.
- Rotatable from the UI. If a creator leaks a URL on stream, they revoke it and
  paste a new one.
- Read/realtime scope only. A browser source can never write data.
- No OAuth token, no service credential and no account identifier appears in the
  URL — these URLs live in OBS configuration files for months.

## Editor (Phase 5–6)

```
┌──────────────────────────────────────────────┐
│ Overlay Editor                     Preview   │
├───────────┬──────────────────────┬───────────┤
│ ELEMENTS  │                      │ SETTINGS  │
│ Alerts    │       CANVAS         │ Position  │
│ Webcam    │                      │ Size      │
│ Text      │                      │ Color     │
│ Images    │                      │ Animation │
├───────────┴──────────────────────┴───────────┤
│ AI COMMAND                              Save │
└──────────────────────────────────────────────┘
```

MVP: place, move, resize, layer, brand colours, preview events. Not a Figma
clone.

AI editing (later) modifies the structured overlay JSON — never generated
application code. "Move my webcam to the left" becomes a validated change to a
widget's `x`, and nothing else.
