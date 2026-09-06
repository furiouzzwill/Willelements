import 'server-only'

/**
 * Structured generation.
 *
 * The model is never asked for prose, code or markup — only for a JSON object
 * matching a schema the app supplies. `docs/ai-generation.md` makes the reason
 * a security boundary rather than a style choice: AI produces a validated
 * specification, and controlled application code turns that into a widget.
 * Nothing generated here is ever executed.
 *
 * The provider's own strict mode is used as a first filter, not as the
 * guarantee. Whatever comes back is parsed by the app's Zod schema before
 * anything looks at it, because a model that returns a plausible object is not
 * the same as a model that returns a valid one.
 */

const ENDPOINT = 'https://api.openai.com/v1/responses'

/** Generous for a small object, short enough that a hung request does not sit forever. */
const TIMEOUT_MS = 90_000

export type TextErrorKind = 'no-key' | 'auth' | 'rate-limit' | 'refused' | 'network' | 'provider'

/**
 * Fields declared and assigned rather than as constructor parameter
 * properties — Node's strip-only TypeScript cannot load those, and the test
 * harness runs on it. See `providers/openai/images.ts` for the same note.
 */
export class TextProviderError extends Error {
  readonly kind: TextErrorKind

  constructor(message: string, kind: TextErrorKind) {
    super(message)
    this.name = 'TextProviderError'
    this.kind = kind
  }
}

export type StructuredRequest = {
  model: string
  system: string
  user: string
  /** A JSON Schema the provider is told to satisfy exactly. */
  schema: Record<string, unknown>
  schemaName: string
}

export type StructuredResult = {
  /** Parsed JSON. Still untrusted — the caller validates it. */
  value: unknown
  inputTokens: number | null
  outputTokens: number | null
}

export function hasApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

export async function generateStructured(request: StructuredRequest): Promise<StructuredResult> {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) {
    throw new TextProviderError(
      'No OpenAI API key. Add OPENAI_API_KEY to .env.local and restart.',
      'no-key',
    )
  }

  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: request.model,
        input: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: request.schemaName,
            strict: true,
            schema: request.schema,
          },
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    throw new TextProviderError(
      error instanceof Error && error.name === 'TimeoutError'
        ? 'The provider did not answer in time. Nothing was changed.'
        : 'Could not reach the provider. Check your connection.',
      'network',
    )
  }

  if (!response.ok) throw await toError(response)

  const payload = (await response.json()) as {
    output_text?: string
    output?: { content?: { type?: string; text?: string }[] }[]
    usage?: { input_tokens?: number; output_tokens?: number }
  }

  const text = payload.output_text ?? extractText(payload.output)
  if (!text) {
    throw new TextProviderError('The provider answered without a result.', 'provider')
  }

  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    // Strict mode should make this impossible. It is still checked, because
    // "should be impossible" is not a thing to hand to a parser.
    throw new TextProviderError('The provider returned something that is not JSON.', 'provider')
  }

  return {
    value,
    inputTokens: payload.usage?.input_tokens ?? null,
    outputTokens: payload.usage?.output_tokens ?? null,
  }
}

/** The Responses API nests text under output[].content[]; `output_text` is a convenience. */
function extractText(output: { content?: { type?: string; text?: string }[] }[] | undefined) {
  if (!output) return null

  for (const item of output) {
    for (const part of item.content ?? []) {
      if (part.text) return part.text
    }
  }

  return null
}

async function toError(response: Response): Promise<TextProviderError> {
  let detail = ''
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    detail = body.error?.message ?? ''
  } catch {
    // A non-JSON error body is not worth failing over; the status still is.
  }

  if (response.status === 401) {
    return new TextProviderError(
      'The provider rejected the API key. Check OPENAI_API_KEY in .env.local.',
      'auth',
    )
  }

  if (response.status === 429) {
    return new TextProviderError(
      detail || 'Rate limited, or the account is out of credit. Nothing was charged for this.',
      'rate-limit',
    )
  }

  if (response.status === 400 && /safety|content|policy|refus/i.test(detail)) {
    return new TextProviderError(`The provider refused that description: ${detail}`, 'refused')
  }

  return new TextProviderError(detail || `The provider returned ${response.status}.`, 'provider')
}
