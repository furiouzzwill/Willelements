# Brand DNA

**Status: implemented (Phase 3).** Edit it at `/brand`.

Brand DNA is the creator's persistent visual identity and the single source of
truth for everything the platform generates on their behalf. A logo, an overlay,
a follower alert, a BRB screen and a social graphic should all look like they
came from the same studio, because they did.

## Shape

```json
{
  "name": "NightShift Gaming",
  "creatorType": "streamer",
  "description": "Late-night gaming and technology creator.",
  "audience": "Gamers ages 18-35",
  "personality": ["futuristic", "premium", "energetic"],
  "colors": {
    "primary": "#A855F7",
    "secondary": "#D946EF",
    "background": "#09090B",
    "text": "#FFFFFF"
  },
  "typography": { "heading": "Space Grotesk", "body": "Inter" },
  "visualStyle": { "canvas": "dark", "style": "futuristic tech", "detail": "minimal" },
  "motionStyle": { "energy": "high", "speed": "fast", "style": ["smooth", "technical", "neon"] },
  "rules": {
    "prefer": ["thin neon borders", "minimal text", "geometric layouts"],
    "avoid": ["cartoon illustrations", "oversized logos", "excessive particles"]
  }
}
```

Stored as JSONB columns on `brands` — flexible enough to evolve, queryable
enough to be useful, and versionable so a creator can see what changed.

## Studio sections

All on one page at `/brand`, edited against a single live preview.

| Section | Fields | Status |
| --- | --- | --- |
| Identity | Name, description, audience, creator type | ✅ |
| Colors | Primary, secondary, accent, background, text | ✅ |
| Typography | Heading, body | ✅ |
| Visual style | Canvas, style, detail | ✅ |
| Motion style | Energy, speed, character | ✅ |
| Personality & rules | Personality, prefer, avoid | ✅ |
| Logo | Upload, primary selection — at `/brand/logos` | ✅ |
| Social handles | — | Later |
| Logo generation | — | Phase 9 |

### The preview

The studio shows a follower alert rendered in the current brand, updating as
you type rather than after you save. It exists because Brand DNA is otherwise
abstract: a colour picker tells you nothing about whether your text will be
readable over stream footage.

It is illustrative, not the alert runtime. Phase 6 builds the real one inside
the OBS browser source, where the performance rules are different.

## How it is consumed

```
Brand DNA
   ├─▶ Overlay widget styling          (Phase 5–6)
   ├─▶ Alert appearance and motion     (Phase 6)
   ├─▶ HyperFrames visual identity     (Phase 8)
   └─▶ Image generation prompts        (Phase 9)
```

Always define the visual identity before generating a composition. A generation
that ignores Brand DNA is a bug, not a style choice.

## Brand learning

No machine learning in the near term. But store the signals that would make it
possible later: which generations were approved, which were rejected, what got
regenerated, which assets are reused, which colours and animations recur, and
what the creator changed by hand afterwards. Cheap to record now, impossible to
reconstruct later.

## One firm rule

Brand DNA styles the **creator's** output. It never styles the **application**.
The product's own chrome uses the design tokens in `src/app/globals.css` and
looks the same for every account.
