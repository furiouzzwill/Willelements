/**
 * Shown instead of the auth form when Supabase env vars are absent, so a fresh
 * clone renders a useful instruction rather than a runtime crash.
 */
export function SupabaseNotice() {
  return (
    <div className="panel space-y-2 p-4">
      <p className="font-display text-sm font-semibold text-ink">Supabase is not configured</p>
      <p className="text-sm text-ink-muted">
        Copy <code className="font-mono text-xs text-ink">.env.example</code> to{' '}
        <code className="font-mono text-xs text-ink">.env.local</code> and add your project
        URL and publishable key, then restart the dev server.
      </p>
    </div>
  )
}
