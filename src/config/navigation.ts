/**
 * The product's information architecture.
 *
 * The full navigation is declared up front so the shell, breadcrumbs and future
 * command palette all read from one source. `phase` records when a destination
 * becomes real; anything above the current phase renders as a locked item
 * rather than a dead link, so the app never lies about what works yet.
 */

export const CURRENT_PHASE = 6

export type NavItem = {
  label: string
  href: string
  /**
   * The phase in which this destination becomes functional.
   *
   * Lower this **only** when the route actually exists. Items at or below
   * `CURRENT_PHASE` render as real links, and Next prefetches them — so an
   * unlocked item without a page produces a stream of 404s in the background,
   * and a dead link if anyone clicks it. There is a test that checks every
   * unlocked destination against the routes on disk.
   */
  phase: number
  description?: string
}

export type NavSection = {
  label: string
  icon: IconName
  items: NavItem[]
}

export type IconName =
  | 'home'
  | 'stream'
  | 'sparkle'
  | 'brand'
  | 'analytics'
  | 'activity'
  | 'community'
  | 'integrations'
  | 'settings'

export const navigation: NavSection[] = [
  {
    label: 'Home',
    icon: 'home',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        phase: 1,
        description: 'Your command center',
      },
    ],
  },
  {
    label: 'Stream',
    icon: 'stream',
    items: [
      { label: 'Overlays', href: '/stream/overlays', phase: 5 },
      { label: 'Alerts', href: '/stream/alerts', phase: 6 },
      { label: 'Overlay Editor', href: '/stream/editor', phase: 8 },
      { label: 'Widgets', href: '/stream/widgets', phase: 8 },
      { label: 'Goals', href: '/stream/goals', phase: 8 },
      { label: 'Labels', href: '/stream/labels', phase: 8 },
      { label: 'Scenes', href: '/stream/scenes', phase: 9 },
    ],
  },
  {
    label: 'Create',
    icon: 'sparkle',
    items: [
      { label: 'AI Create', href: '/create', phase: 9 },
      { label: 'Stream Packages', href: '/create/packages', phase: 9 },
      { label: 'Graphics', href: '/create/graphics', phase: 9 },
      { label: 'Animations', href: '/create/animations', phase: 8 },
      { label: 'Social Content', href: '/create/social', phase: 9 },
      { label: 'Templates', href: '/create/templates', phase: 9 },
    ],
  },
  {
    label: 'Brand',
    icon: 'brand',
    items: [
      // Colours, fonts, visual style, motion style and rules are all sections
      // of the Brand Studio rather than separate pages — they are edited
      // together, against one preview, and splitting them would mean five
      // near-empty screens.
      { label: 'Brand DNA', href: '/brand', phase: 3 },
      { label: 'Logos', href: '/brand/logos', phase: 3 },
      { label: 'Asset Library', href: '/brand/assets', phase: 3 },
    ],
  },
  {
    label: 'Analytics',
    icon: 'analytics',
    items: [
      { label: 'Overview', href: '/analytics', phase: 7 },
      { label: 'Twitch', href: '/analytics/twitch', phase: 7 },
      { label: 'YouTube', href: '/analytics/youtube', phase: 10 },
      { label: 'Streams', href: '/analytics/streams', phase: 7 },
      { label: 'Audience', href: '/analytics/audience', phase: 7 },
      { label: 'Growth', href: '/analytics/growth', phase: 10 },
    ],
  },
  {
    label: 'Activity',
    icon: 'activity',
    items: [{ label: 'Activity Feed', href: '/activity', phase: 7 }],
  },
  {
    label: 'Community',
    icon: 'community',
    items: [
      { label: 'Chatbot', href: '/community/chatbot', phase: 11 },
      { label: 'Commands', href: '/community/commands', phase: 11 },
      { label: 'Timers', href: '/community/timers', phase: 11 },
      { label: 'Giveaways', href: '/community/giveaways', phase: 11 },
    ],
  },
  {
    label: 'Integrations',
    icon: 'integrations',
    items: [
      { label: 'Twitch', href: '/integrations/twitch', phase: 4 },
      { label: 'OBS', href: '/integrations/obs', phase: 8 },
      { label: 'YouTube', href: '/integrations/youtube', phase: 10 },
    ],
  },
  {
    label: 'Settings',
    icon: 'settings',
    items: [
      // Connected accounts live under Integrations rather than being duplicated
      // here — two navigation entries pointing at one page is a dead end for
      // anyone trying to work out where a setting actually lives.
      { label: 'Storage', href: '/settings', phase: 1 },
      { label: 'Notifications', href: '/settings/notifications', phase: 9 },
    ],
  },
]

export function isAvailable(item: NavItem): boolean {
  return item.phase <= CURRENT_PHASE
}

/** Every route that exists today, for the shell's active-link matching. */
export function findNavItem(pathname: string): NavItem | undefined {
  return navigation
    .flatMap((section) => section.items)
    .find((item) => item.href === pathname)
}
