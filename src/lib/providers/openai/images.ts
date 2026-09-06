import 'server-only'

import { DEFAULT_MODEL, type ImageModel, type ImageQuality, type ImageSize } from '@/lib/providers/openai/pricing'

/**
 * The image API, as a thin function.
 *
 * No SDK. The whole surface this app uses is one POST returning base64, and a
 * dependency that wraps it would be more code to audit than the code it saves.
 * The project already takes this line with the HyperFrames CLI and with GSAP.
 *
 * The key is read at call time rather than at import, so adding it to
 * `.env.local` and restarting is the whole setup — and so a missing key is a
 * message on the page instead of a crash at boot.
 */

const ENDPOINT = 'https://api.openai.com/v1/images/generations'

/** Generation is slow — minutes at high quality — and the default fetch timeout is not. */
const TIMEOUT_MS = 300_000

export type ImageErrorKind =
  | 'no-key'
  | 'auth'
  | 'rate-limit'
  | 'refused'
  | 'network'
  | 'provider'

/**
 * Fields are declared and assigned rather than written as constructor
 * parameter properties. Node runs this project's TypeScript by stripping types,
 * and a parameter property is syntax rather than a type — it fails to load.
 * `next build` compiles with SWC and would not have caught it; the test runner
 * does. `TwitchApiError` is written the same way for the same reason.
 */
export class ImageProviderError extends Error {
  readonly kind: ImageErrorKind

  constructor(message: string, kind: ImageErrorKind) {
    super(message)
    this.name = 'ImageProviderError'
    this.kind = kind
  }
}

export function hasApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

export type GenerateInput = {
  prompt: string
  model?: ImageModel
  quality?: ImageQuality
  size?: ImageSize
  /** Only the logo subject asks for this; most backgrounds want opaque. */
  transparent?: boolean
}

export type GeneratedImage = {
  bytes: Uint8Array
  mime: string
  model: string
}

export async function generateImage(input: GenerateInput): Promise<GeneratedImage> {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) {
    throw new ImageProviderError(
      'No OpenAI API key. Add OPENAI_API_KEY to .env.local and restart.',
      'no-key',
    )
  }

  const model = input.model ?? DEFAULT_MODEL

  const body = {
    model,
    prompt: input.prompt,
    n: 1,
    size: input.size ?? '1024x1024',
    quality: input.quality ?? 'medium',
    // PNG throughout: it is the only offered format with an alpha channel, so
    // a transparent logo needs it, and lossless is the right default for
    // artwork that may be scaled or edited later anyway.
    output_format: 'png',
    ...(input.transparent ? { background: 'transparent' } : {}),
  }

  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    throw new ImageProviderError(
      error instanceof Error && error.name === 'TimeoutError'
        ? 'The provider did not answer in time. Nothing was generated.'
        : 'Could not reach the provider. Check your connection.',
      'network',
    )
  }

  if (!response.ok) {
    throw await toError(response)
  }

  const payload = (await response.json()) as {
    data?: { b64_json?: string; revised_prompt?: string }[]
  }

  const encoded = payload.data?.[0]?.b64_json
  if (!encoded) {
    throw new ImageProviderError(
      'The provider answered without an image. Nothing was saved.',
      'provider',
    )
  }

  return {
    bytes: Uint8Array.from(Buffer.from(encoded, 'base64')),
    mime: 'image/png',
    model,
  }
}

/**
 * A provider error turned into something worth reading.
 *
 * The status alone is not enough — a 400 from a content refusal and a 400 from
 * a malformed size need different responses from the person reading it, and
 * "Request failed with status 400" tells them neither.
 */
async function toError(response: Response): Promise<ImageProviderError> {
  let detail = ''
  try {
    const body = (await response.json()) as { error?: { message?: string; code?: string } }
    detail = body.error?.message ?? ''
  } catch {
    // A non-JSON error body is not worth failing over; the status still is.
  }

  if (response.status === 401) {
    return new ImageProviderError(
      'The provider rejected the API key. Check OPENAI_API_KEY in .env.local.',
      'auth',
    )
  }

  if (response.status === 429) {
    return new ImageProviderError(
      detail || 'Rate limited, or the account is out of credit. Nothing was charged for this.',
      'rate-limit',
    )
  }

  if (response.status === 400 && /safety|content|policy|rejected/i.test(detail)) {
    return new ImageProviderError(
      `The provider refused this prompt: ${detail}`,
      'refused',
    )
  }

  return new ImageProviderError(
    detail || `The provider returned ${response.status}.`,
    'provider',
  )
}
