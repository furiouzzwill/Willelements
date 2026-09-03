# AI generation

**Status: planned (Phase 9). Not implemented.**

## Image generation

> ⚠️ **Check the current official OpenAI documentation before implementing**:
> <https://developers.openai.com/api/>
>
> Verify the recommended endpoint, the current model names, input/output
> formats, supported sizes and response shape. Do not code from remembered
> model names.

At the time of writing, OpenAI's image models are served from
`/v1/images/generations`, and the GPT Image family has moved through several
generations with differing size support. Confirm all of it at implementation
time.

Used for: logo concepts, brand graphics, backgrounds, stream and scene artwork,
icons, patterns, social graphics.

### Rules

- Server-side only. The API key never reaches the browser.
- Everything goes through `ImageGenerationService`, so the provider can change
  without touching feature code.
- Brand DNA feeds every prompt.
- Generated assets land in the library with their prompt, provider and model
  recorded — both for reproducibility and for brand learning later.
- Rate-limited, and recorded as usage events. **Never expose an unrestricted
  expensive generation endpoint.**

## Structured generation

Avoid arbitrary AI-generated executable code in production. AI produces a
validated specification; controlled application code turns it into a widget or a
composition.

```json
{
  "type": "subscriber-alert",
  "duration": 5,
  "brandId": "uuid",
  "layout": "centered",
  "elements": [
    { "type": "logo", "animation": "scale" },
    { "type": "label", "value": "NEW SUBSCRIBER", "animation": "word-reveal" },
    { "type": "username", "value": "{{username}}", "animation": "fade" }
  ],
  "entrance": "glitch",
  "exit": "fade"
}
```

Every specification is schema-validated before use. An element type that is not
in the registry is rejected — it is not passed through and hoped for.

This is a security boundary, not a style preference:

- Never execute arbitrary user JavaScript in the primary application.
- Never blindly execute AI-generated JavaScript.
- Custom widgets, if they ever ship, require an isolated sandbox first.

## AI Create studio

The eventual interface: a creator describes what they want — "a purple cyberpunk
subscriber alert using my logo", "a Halloween version of my stream package",
"a 10K followers celebration scene" — and the system combines Brand DNA,
connected-platform context, existing approved assets, the creation type, the
output dimensions and motion preferences into a specification.

## Language

The product never exposes its plumbing.

| Say | Not |
| --- | --- |
| Create Alert | Generate HyperFrames composition |
| Generate Logo | Call image API |
| Connect Twitch | Configure OAuth scopes |

## Cost control

Image generation and rendering cost money. `UsageService` records
`image_generation`, `video_render`, `ai_command`, `storage` and `render_minutes`
from early on — long before billing exists — because an architecture that cannot
measure usage cannot later constrain it.
