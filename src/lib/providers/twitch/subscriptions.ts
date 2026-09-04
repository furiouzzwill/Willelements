/**
 * The EventSub subscriptions this app creates, and what each one costs in
 * permissions.
 *
 * Verified against dev.twitch.tv at implementation time — versions and scope
 * requirements here are not remembered, and `channel.follow` in particular has
 * changed both before.
 *
 * Note that raids and stream online/offline require **no scope at all**. They
 * work the moment a channel is connected, which is why the connection is worth
 * something even before a creator grants anything else.
 */

export type SubscriptionDefinition = {
  /** The internal event type this maps to. */
  eventType: string
  type: string
  version: string
  /** Scope needed to create it, or null when none is required. */
  scope: string | null
  /**
   * How the condition is built. `broadcaster` covers the common case;
   * `follow` additionally needs the moderator id; `raid` uses a different
   * field name entirely because the subscription is directional.
   */
  condition: 'broadcaster' | 'follow' | 'raid'
}

export const SUBSCRIPTIONS: SubscriptionDefinition[] = [
  {
    eventType: 'channel.follow',
    type: 'channel.follow',
    version: '2',
    scope: 'moderator:read:followers',
    condition: 'follow',
  },
  {
    eventType: 'channel.raid',
    type: 'channel.raid',
    version: '1',
    scope: null,
    condition: 'raid',
  },
  {
    eventType: 'stream.online',
    type: 'stream.online',
    version: '1',
    scope: null,
    condition: 'broadcaster',
  },
  {
    eventType: 'stream.offline',
    type: 'stream.offline',
    version: '1',
    scope: null,
    condition: 'broadcaster',
  },
  {
    eventType: 'channel.subscribe',
    type: 'channel.subscribe',
    version: '1',
    scope: 'channel:read:subscriptions',
    condition: 'broadcaster',
  },
  {
    eventType: 'channel.subscription.gift',
    type: 'channel.subscription.gift',
    version: '1',
    scope: 'channel:read:subscriptions',
    condition: 'broadcaster',
  },
  {
    eventType: 'channel.cheer',
    type: 'channel.cheer',
    version: '1',
    scope: 'bits:read',
    condition: 'broadcaster',
  },
]

/** Builds the condition object for a subscription. */
export function conditionFor(
  definition: SubscriptionDefinition,
  broadcasterId: string,
): Record<string, string> {
  switch (definition.condition) {
    case 'follow':
      // v2 requires the moderator id as well; for a broadcaster reading their
      // own channel, that is the same user.
      return { broadcaster_user_id: broadcasterId, moderator_user_id: broadcasterId }
    case 'raid':
      // Raids *into* this channel. Setting from_broadcaster_user_id instead
      // would subscribe to raids this channel sends out.
      return { to_broadcaster_user_id: broadcasterId }
    default:
      return { broadcaster_user_id: broadcasterId }
  }
}

/** The subscriptions a token with these scopes is allowed to create. */
export function subscriptionsFor(scopes: string[]): SubscriptionDefinition[] {
  return SUBSCRIPTIONS.filter(
    (definition) => definition.scope === null || scopes.includes(definition.scope),
  )
}

/** The subscriptions this token cannot create, and the scope each would need. */
export function missingScopes(scopes: string[]): { eventType: string; scope: string }[] {
  return SUBSCRIPTIONS.filter(
    (definition) => definition.scope !== null && !scopes.includes(definition.scope),
  ).map((definition) => ({ eventType: definition.eventType, scope: definition.scope! }))
}

/** Every scope we ask for, deduplicated. */
export const ALL_SCOPES = [
  ...new Set(
    SUBSCRIPTIONS.map((definition) => definition.scope).filter(
      (scope): scope is string => scope !== null,
    ),
  ),
]

/** Human wording for what each scope buys, shown on the integrations page. */
export const SCOPE_PURPOSE: Record<string, string> = {
  'moderator:read:followers': 'your follower count, and follower alerts',
  'channel:read:subscriptions': 'subscriber and gift-sub alerts',
  'bits:read': 'cheer alerts',
}
