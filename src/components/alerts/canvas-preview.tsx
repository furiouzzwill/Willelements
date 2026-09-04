'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Shows an alert at true scale inside a smaller box.
 *
 * The alert is laid out at the real canvas size and then scaled down as a
 * whole, rather than being rendered smaller. That is the difference between a
 * preview and an approximation: line breaks, spacing and overflow all land
 * exactly where they will on the actual overlay.
 */
export function CanvasPreview({
  width = 1920,
  height = 1080,
  children,
}: {
  width?: number
  height?: number
  children: ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / width)
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [width])

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg border border-line"
      style={{ aspectRatio: `${width} / ${height}`, background: '#0b1020' }}
    >
      {/* A stand-in for gameplay, so contrast is judged against something. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(60% 60% at 25% 30%, #1e3a5f, transparent), radial-gradient(50% 50% at 80% 70%, #3b1e5f, transparent)',
        }}
      />

      <div
        className="absolute top-0 left-0 grid place-items-center"
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          // Hidden until measured, so it never flashes at full size.
          visibility: scale > 0 ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}
