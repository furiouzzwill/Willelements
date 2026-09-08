# AI generation

**Status: implemented.** Image generation ships as AI Create and Stream
Packages. Structured generation ships as **Design by description** on each
alert — the first piece of the AI Create studio described below.

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

**Motion is composed, not chosen.** The first version let the model pick an
entrance from a list of six, which was a ceiling: whatever anyone described,
the answer was one of six, and every design settled into the same handful of
looks. A spec now carries a `motion` timeline — per part, a list of keyframes
with real numbers — which `lib/motion/compile.ts` turns into actual CSS
`@keyframes`.

That does not cross the line above. Nothing in a timeline is code: a track
names a part from a closed set and an easing from a closed set, and everything
else is a bounded number. **The application writes every character of the
stylesheet**; no text from a model is ever concatenated into a rule. Easings
are table lookups rather than `cubic-bezier(...)` strings for exactly that
reason, and every value is clamped to what the layout can survive — an
unbounded translate would push an alert off the canvas, and a large enough
scale would cover the stream.

The timeline is optional. Alerts saved before it existed keep their named
entrance and render exactly as they did.

This is a security boundary, not a style preference:

- Never execute arbitrary user JavaScript in the primary application.
- Never blindly execute AI-generated JavaScript.
- Custom widgets, if they ever ship, require an isolated sandbox first.

## AI Create studio

**Shipped for alerts.** Open any alert, describe it — "loud and aggressive,
glitchy, big name, no logo" — and the controls fill in. The model returns a
specification against a JSON Schema built from the app's own element and
animation constants, so the two cannot drift; the result is then parsed by the
same Zod schema the renderer uses, which is the gate that actually decides.
Nothing is saved until you press Save, and a design costs about $0.0002.

Verified against the real API with opposite descriptions: "loud and aggressive,
glitchy, no logo" produced a glitch entrance at volume 1 with no logo, while
"calm and minimal, just the name, quiet" produced a fade at volume 0.3 with the
logo — and dropped the label element entirely, because the description said
*just* the name.

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
