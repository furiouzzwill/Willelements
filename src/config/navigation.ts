/**
 * The product's information architecture.
 *
 * The full navigation is declared up front so the shell, breadcrumbs and future
 * command palette all read from one source. `phase` records when a destination
 * becomes real; anything above the current phase renders as a locked item
 * rather than a dead link, so the app never lies about what works yet.
 */

export const CURRENT_PHASE = 1

export type NavItem = {
  label: string
  href: string
  /** Development phase in which this destination becomes functional. */
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
  | 'monetization'
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
      { label: 'Overlay Editor', href: '/stream/editor', phase: 5 },
      { label: 'Alerts', href: '/stream/alerts', phase: 6 },
      { label: 'Widgets', href: '/stream/widgets', phase: 5 },
      { label: 'Scenes', href: '/stream/scenes', phase: 5 },
      { label: 'Browser Sources', href: '/stream/browser-sources', phase: 5 },
      { label: 'Goals', href: '/stream/goals', phase: 6 },
      { label: 'Labels', href: '/stream/labels', phase: 6 },
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
      { label: 'Brand DNA', href: '/brand', phase: 3 },
      { label: 'Logos', href: '/brand/logos', phase: 3 },
      { label: 'Colors', href: '/brand/colors', phase: 3 },
      { label: 'Fonts', href: '/brand/fonts', phase: 3 },
      { label: 'Visual Style', href: '/brand/visual-style', phase: 3 },
      { label: 'Motion Style', href: '/brand/motion-style', phase: 3 },
      { label: 'Brand Rules', href: '/brand/rules', phase: 3 },
      { label: 'Asset Library', href: '/brand/assets', phase: 3 },
    ],
  },
  {
    label: 'Analytics',
    icon: 'analytics',
    items: [
      { label: 'Overview', href: '/analytics', phase: 4 },
      { label: 'Twitch', href: '/analytics/twitch', phase: 4 },
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
      { label: 'Moderation', href: '/community/moderation', phase: 11 },
      { label: 'Giveaways', href: '/community/giveaways', phase: 11 },
      { label: 'Loyalty', href: '/community/loyalty', phase: 11 },
    ],
  },
  {
    label: 'Monetization',
    icon: 'monetization',
    items: [
      { label: 'Tips', href: '/monetization/tips', phase: 12 },
      { label: 'Goals', href: '/monetization/goals', phase: 12 },
      { label: 'Sponsors', href: '/monetization/sponsors', phase: 12 },
    ],
  },
  {
    label: 'Integrations',
    icon: 'integrations',
    items: [
      { label: 'Twitch', href: '/integrations/twitch', phase: 4 },
      { label: 'YouTube', href: '/integrations/youtube', phase: 10 },
      { label: 'OBS', href: '/integrations/obs', phase: 5 },
    ],
  },
  {
    label: 'Settings',
    icon: 'settings',
    items: [
      { label: 'Account', href: '/settings', phase: 1 },
      { label: 'Connected Accounts', href: '/settings/connections', phase: 4 },
      { label: 'Security', href: '/settings/security', phase: 1 },
      { label: 'Notifications', href: '/settings/notifications', phase: 6 },
      { label: 'Billing', href: '/settings/billing', phase: 12 },
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
