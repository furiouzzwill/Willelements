import type { IconName } from '@/config/navigation'

/**
 * Inline SVG icon set. Deliberately not an icon-library dependency: the set is
 * small, and inlining keeps it out of the client bundle for server-rendered
 * chrome.
 */
const paths: Record<IconName | 'lock' | 'logout' | 'plus' | 'chevron', string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
  stream: 'M3 5h18v11H3zM8 20h8M12 16v4',
  sparkle: 'M12 3l2 5.5L19.5 10 14 12l-2 5.5L10 12 4.5 10 10 8.5zM18.5 15l.9 2.3 2.1.7-2.1.7-.9 2.3-.9-2.3-2.1-.7 2.1-.7z',
  brand: 'M12 3l7.5 4.3v8.6L12 20.2 4.5 15.9V7.3zM12 3v8.6m0 0 7.5 4.3M12 11.6 4.5 15.9',
  analytics: 'M4 20V10m5 10V4m5 16v-7m5 7V8',
  activity: 'M3 12h4l2.5-6 4 13L16 12h5',
  community: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M17 11.5a3 3 0 1 0 0-6M18 20a6 6 0 0 0-2-4.4',
  monetization: 'M12 3v18M8 7.5h6a2.5 2.5 0 0 1 0 5H9.5a2.5 2.5 0 0 0 0 5H16',
  integrations: 'M9 3v4M15 3v4M5 7h14v6a7 7 0 0 1-14 0zM12 20v1',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.9h-.2a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.7 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 17 4.7l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.6 1.1Z',
  lock: 'M7 10V7.5a5 5 0 0 1 10 0V10M5 10h14v10H5z',
  logout: 'M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5M11 5h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6',
  plus: 'M12 5v14M5 12h14',
  chevron: 'm9 6 6 6-6 6',
}

export function Icon({
  name,
  className = 'size-4',
}: {
  name: keyof typeof paths
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  )
}

/** The product mark. Intentionally generic — creators bring their own brand. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 text-accent">
        <path
          d="M12 2.5 21 7.75v8.5L12 21.5 3 16.25v-8.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        <path d="M12 8.5 16 11v3l-4 2.5L8 14v-3z" fill="currentColor" />
      </svg>
      <span className="font-display text-base font-semibold tracking-tight text-ink">
        Willelements
      </span>
    </span>
  )
}
