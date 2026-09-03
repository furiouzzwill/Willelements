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
http://localhost:3000/overlay/{publicToken}
```

Rules for this route, which override editor convenience every time:

- Transparent background, no dashboard chrome, no application shell.
- Minimal JavaScript. Nothing from the editor bundle reaches it.
- **Server-Sent Events**, not WebSockets. The overlay only ever receives, and
  the browser's `EventSource` reconnects on its own — a browser source that sat
  in OBS for a week recovers without any reconnect logic of ours.
- Same machine as the server, so the event path is localhost to localhost.

A beautiful editor is worthless if the resulting overlay stutters on stream.

## Security

- `publicToken` is 128 bits of randomness, unrelated to the overlay's row ID.
  Not sequential, not guessable.
- Rotatable from the UI. If you show the URL on stream by accident, rotate it
  and paste the new one — nothing else breaks.
- Read-only. A browser source can never write data.
- No provider token and no credential appears in the URL — these live in OBS
  configuration files for months.

The app binds to localhost, so the overlay is not reachable from outside the
machine in the first place. The token still matters: it keeps overlays distinct
from one another, and it stays correct if you ever expose the app on a LAN to
drive a second machine's OBS.

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
