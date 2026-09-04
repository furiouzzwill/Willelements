import 'server-only'

import { constants } from 'node:fs'
import { access, copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { VisualIdentity } from '@/lib/hyperframes/identity'
import type { CompositionInput, CompositionTemplate } from '@/lib/hyperframes/templates'

/**
 * Writing a composition to disk as a real HyperFrames project.
 *
 * The CLI renders a *directory*, not a string, so every render materialises one:
 * an `index.html`, a `hyperframes.json`, and the assets the composition
 * references. Projects are kept after the render rather than deleted — when a
 * video comes out wrong, the composition that produced it is the only thing
 * that explains why, and it is a few kilobytes of HTML.
 */

/** Pinned. A floating version would change how renders look with no commit. */
export const HYPERFRAMES_VERSION = '0.8.27'

/** Where the vendored GSAP build lands inside a project. */
const VENDOR_GSAP = path.join('assets', 'vendor', 'gsap.min.js')

/** And where it comes from. See vendor/gsap/README.md for why it is committed. */
export function gsapSourcePath(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), 'vendor', 'gsap', 'gsap.min.js')
}

export type ProjectPlan = {
  template: CompositionTemplate
  identity: VisualIdentity
  brandName: string
  input: CompositionInput
  /** Absolute path to the brand's logo file, or null if it has none. */
  logoPath: string | null
  durationSeconds: number
}

export type WrittenProject = {
  dir: string
  indexPath: string
  /** The logo path as the composition references it, for tests and debugging. */
  logoSrc: string | null
}

const HYPERFRAMES_CONFIG = {
  $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json',
  paths: {
    blocks: 'compositions',
    components: 'compositions/components',
    assets: 'assets',
  },
}

/**
 * Builds the project directory for one render.
 *
 * Replaces anything already at `dir`: a retry of the same job must not inherit
 * a half-written project from the attempt that failed.
 */
export async function writeProject(dir: string, plan: ProjectPlan): Promise<WrittenProject> {
  await rm(dir, { recursive: true, force: true })
  await mkdir(path.join(dir, 'assets', 'vendor'), { recursive: true })

  const gsap = gsapSourcePath()
  try {
    await access(gsap, constants.R_OK)
  } catch {
    throw new Error(
      `GSAP is missing at ${gsap}. Compositions cannot render without it — ` +
        'restore vendor/gsap/gsap.min.js from the repository.',
    )
  }
  await copyFile(gsap, path.join(dir, VENDOR_GSAP))

  let logoSrc: string | null = null
  if (plan.logoPath) {
    const extension = path.extname(plan.logoPath) || '.png'
    const relative = path.join('assets', `logo${extension}`)
    await copyFile(plan.logoPath, path.join(dir, relative))
    // Always posix separators: this string goes into an HTML `src`.
    logoSrc = relative.split(path.sep).join('/')
  }

  const html = plan.template.build({
    identity: plan.identity,
    brandName: plan.brandName,
    input: plan.input,
    logoSrc,
    width: plan.template.width,
    height: plan.template.height,
    durationSeconds: plan.durationSeconds,
  })

  const indexPath = path.join(dir, 'index.html')

  await Promise.all([
    writeFile(indexPath, html, 'utf8'),
    writeFile(
      path.join(dir, 'hyperframes.json'),
      `${JSON.stringify(HYPERFRAMES_CONFIG, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      path.join(dir, 'package.json'),
      `${JSON.stringify(
        {
          name: `willelements-${plan.template.id}`,
          private: true,
          type: 'module',
          scripts: {
            preview: `npx --yes hyperframes@${HYPERFRAMES_VERSION} preview`,
            check: `npx --yes hyperframes@${HYPERFRAMES_VERSION} check`,
            render: `npx --yes hyperframes@${HYPERFRAMES_VERSION} render`,
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    ),
  ])

  return { dir, indexPath, logoSrc }
}
