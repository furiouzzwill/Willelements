import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { register } from 'node:module'

/**
 * Lets `node --test` load application modules directly.
 *
 * Node runs TypeScript natively, but it does not read tsconfig `paths` and it
 * requires explicit file extensions. This hook teaches it two things:
 *
 *  1. `@/x` resolves to `src/x`, matching the tsconfig alias.
 *  2. An extensionless relative import resolves to the `.ts`/`.tsx` file.
 *
 * It also stubs `server-only`, which throws by design when imported outside a
 * React Server Component. That guard exists to catch a Client Component
 * importing server code at build time — a concern that does not apply here, and
 * the real check still runs during `next build`.
 */

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'src')
const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs']

function withExtension(filePath) {
  if (existsSync(filePath) && path.extname(filePath)) return filePath

  for (const extension of EXTENSIONS) {
    const candidate = `${filePath}${extension}`
    if (existsSync(candidate)) return candidate
  }

  for (const extension of EXTENSIONS) {
    const candidate = path.join(filePath, `index${extension}`)
    if (existsSync(candidate)) return candidate
  }

  return null
}

export function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only' || specifier === 'client-only') {
    return {
      shortCircuit: true,
      url: pathToFileURL(path.join(import.meta.dirname, 'empty-module.mjs')).href,
    }
  }

  if (specifier.startsWith('@/')) {
    const resolved = withExtension(path.join(SRC, specifier.slice(2)))
    if (resolved) {
      return { shortCircuit: true, url: pathToFileURL(resolved).href }
    }
  }

  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const parentDir = path.dirname(new URL(context.parentURL).pathname)
    const resolved = withExtension(path.resolve(parentDir, specifier))
    if (resolved) {
      return { shortCircuit: true, url: pathToFileURL(resolved).href }
    }
  }

  return nextResolve(specifier, context)
}

register(import.meta.url, import.meta.url)
