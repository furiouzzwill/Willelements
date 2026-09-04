import 'server-only'

import type { WidgetData } from '@/components/widgets/widget-data'
import { latestEventOfType, listActivity } from '@/lib/services/event-service'
import { getChannelState } from '@/lib/services/twitch-service'

/**
 * The values widgets start with when an overlay loads.
 *
 * Resolved once, server-side, and passed down — so the browser source opens
 * already showing the right numbers rather than flashing placeholders while it
 * fetches. After this, updates arrive on the event stream that is already open
 * for alerts.
 */
export async function buildWidgetData(): Promise<WidgetData> {
  const channel = await getChannelState()

  const recent = listActivity({ limit: 20 }).map((entry) => ({
    label: entry.label,
    name: entry.actorName,
    at: entry.occurredAt,
  }))

  return {
    latestFollower: latestEventOfType('channel.follow')?.actorName ?? null,
    latestSubscriber: latestEventOfType('channel.subscribe')?.actorName ?? null,
    // Null rather than zero when Twitch is not connected — a goal widget
    // showing "0 / 100" would be a number nobody gave us.
    followerCount: channel.status === 'ok' ? channel.followerCount : null,
    recent,
  }
}
