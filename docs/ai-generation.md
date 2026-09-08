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

**The vocabulary is wide on purpose.** A closed set is only a limitation if it
is a small one, so it covers what alerts actually do: independent `scaleX` and
`scaleY` for squash and stretch, `rotateX`/`rotateY` with perspective for
flips, `tracking` for letter spacing, `repeat` and `yoyo` for shakes and
pulses, and decorations — `burst`, `rays`, `ring`, `shine` — for the particles
and sweeps that no amount of translating a text node will ever be.

The app draws every piece of those. A burst says how many, how far and across
what arc; the geometry, the DOM and the CSS are computed here. Colours are
named (`primary`, `accent`) and resolved through a table into CSS variables, so
a specification chooses a colour rather than supplying one.

## Code mode

**A deliberate exception, added on the owner's explicit and repeated
instruction** after the composed timeline was judged not expressive enough.
Written down here rather than left implied, because whoever reads this next
deserves to know it was a decision and not an oversight.

In code mode a model writes a real composition — markup, styles and script —
and it runs. That gives up what the rest of this document protects: it can be
wrong in ways a schema cannot catch.

What contains it:

- It **never runs in the application**. It runs in an iframe with
  `sandbox="allow-scripts"` and nothing else. Not `allow-same-origin` — the two
  together annul each other, since a frame with both can reach its parent and
  remove its own sandbox. With scripts alone the frame has a null origin: no
  cookies, no storage, no handle on the document.
- A **Content-Security-Policy inside the frame permits no network at all**.
  `default-src 'none'` covers every fetch destination there is, so nothing can
  be loaded and nothing can be sent anywhere.
- A **screen** rejects the obviously wrong before anyone previews it — network
  calls, storage, `window.parent`, unbounded loops, nested frames — and it is
  re-run server-side on save, because the composition has been through a
  browser since it was generated.
- Values from viewers are **escaped**. Someone called `<script>alert(1)</script>`
  is a funny name, not an event.

The residual risk is a composition that runs and looks wrong, which is the risk
of any animation anyone writes by hand — and it is previewed before it is saved.

Guided mode remains the default, and an alert with no composition is unchanged.

## What this is still not

What this is *not* is a coding agent. It cannot invent a new kind of thing — a
shader, an SVG morph, a physics simulation — because there is no vocabulary for
those. It can combine what exists in ways nobody enumerated, which is a very
large space, and it is bounded in kind rather than in quantity. That trade is
deliberate: this runs in a browser source on the machine encoding someone's
stream, and the rule against executing generated code is what makes that safe.

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
