# Overlay system

**Status: runtime implemented (Phase 5). Widgets and the editor planned (Phase 6).**

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

Phase 5 renders alerts directly rather than through the widget system; Phase 6
introduces widgets and the editor that places them.

## The event stream

```
Event ──▶ bus.publish(event, overlayId)
              │
              ▼
        subscribers for that overlay
              │
              ▼  text/event-stream
        EventSource in the browser source
              │
              ▼
        alert queue ──▶ one alert at a time
```

The bus is an in-process subscriber list, not a broker — everything runs in one
Node process on one machine. That is the reason a local install has lower alert
latency than a hosted one: nothing leaves the machine.

`publish` returns how many connections received the event, which is what lets
the dashboard say "nothing is listening" rather than appearing to succeed.

Details that matter for OBS:

- A `: ping` comment every 20 seconds, so nothing in between decides the
  connection is idle and closes it.
- `X-Accel-Buffering: no`, so a proxy cannot hold alerts and deliver them in a
  batch several seconds late.
- `retry: 2000`, so a dropped connection comes back in two seconds.
- The request's abort signal unsubscribes and clears the heartbeat, so switching
  scenes does not leak a connection.

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
