'use client'

import { useEffect, useState } from 'react'

import type { BrandDna } from '@/lib/schemas/brand'

/**
 * Live preview of the brand as a follower alert.
 *
 * This is the point of Brand DNA made visible: change a colour and see the
 * thing your viewers will actually see. It reads the surrounding form rather
 * than the saved record, so it updates before you commit.
 *
 * The motion here is illustrative, not the real alert runtime — Phase 6 builds
 * that inside the OBS browser source, where performance rules are different.
 */
export function BrandPreview({ initial, logoUrl }: { initial: BrandDna; logoUrl: string | null }) {
  const [dna, setDna] = useState(initial)
  const [replay, setReplay] = useState(0)

  // Mirror the form's current values rather than the last saved ones.
  useEffect(() => {
    const form = document.getElementById('brand-dna-form')
    if (!(form instanceof HTMLFormElement)) return

    function read() {
      const data = new FormData(form as HTMLFormElement)
      const value = (key: string, fallback: string) => {
        const entry = data.get(key)
        return typeof entry === 'string' && /^#[0-9a-fA-F]{6}$/.test(entry) ? entry : fallback
      }

      setDna((current) => ({
        ...current,
        colors: {
          primary: value('primary', current.colors.primary),
          secondary: value('secondary', current.colors.secondary),
          accent: value('accent', current.colors.accent),
          background: value('background', current.colors.background),
          text: value('text', current.colors.text),
        },
        typography: {
          ...current.typography,
          heading: String(data.get('heading') ?? current.typography.heading),
          body: String(data.get('body') ?? current.typography.body),
        },
      }))
    }

    form.addEventListener('input', read)
    form.addEventListener('change', read)
    return () => {
      form.removeEventListener('input', read)
      form.removeEventListener('change', read)
    }
  }, [])

  const { colors, typography } = dna

  return (
    <div className="space-y-3">
      <div
        key={replay}
        className="relative grid aspect-video place-items-center overflow-hidden rounded-lg border border-line"
        style={{ background: colors.background }}
      >
        {/* A hint of the stream behind the overlay, so contrast is judged fairly. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `radial-gradient(60% 60% at 30% 20%, ${colors.primary}22, transparent), radial-gradient(50% 50% at 80% 80%, ${colors.secondary}22, transparent)`,
          }}
        />

        <div className="animate-[preview-in_600ms_ease-out] relative flex flex-col items-center gap-3 px-6 text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local asset route, already sized
            <img src={logoUrl} alt="" className="size-14 object-contain" />
          ) : (
            <div
              className="grid size-14 place-items-center rounded-xl text-lg font-bold"
              style={{ background: colors.primary, color: colors.background }}
              aria-hidden="true"
            >
              ★
            </div>
          )}

          <p
            className="text-xs font-semibold tracking-[0.2em] uppercase"
            style={{ color: colors.accent, fontFamily: `${typography.heading}, sans-serif` }}
          >
            New follower
          </p>

          <p
            className="text-3xl font-semibold"
            style={{ color: colors.text, fontFamily: `${typography.heading}, sans-serif` }}
          >
            NightOwl_92
          </p>

          <p
            className="text-sm"
            style={{ color: colors.text, opacity: 0.7, fontFamily: `${typography.body}, sans-serif` }}
          >
            Thanks for the follow!
          </p>

          <span
            aria-hidden="true"
            className="mt-1 block h-0.5 w-24 rounded-full"
            style={{ background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setReplay((count) => count + 1)}
        className="text-sm font-medium text-accent hover:underline"
      >
        Replay preview
      </button>

      <style>{`
        @keyframes preview-in {
          from { opacity: 0; transform: translateY(10px) scale(0.96); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  )
}
