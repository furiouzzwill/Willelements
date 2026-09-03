/**
 * The name given to the brand created on a fresh install.
 *
 * Setup completion is inferred from whether this has been changed, rather than
 * stored as a separate "onboarded" flag. One less piece of state to get out of
 * step with reality — and if you delete your brand, the app correctly offers
 * setup again.
 */
export const STARTER_BRAND_NAME = 'My Brand'
