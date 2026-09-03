import { Sidebar } from '@/components/shell/sidebar'
import { Topbar } from '@/components/shell/topbar'
import { displayNameFor, requireUser } from '@/lib/auth/dal'

/**
 * Protected application shell.
 *
 * `requireUser()` is the real authorisation check. The proxy redirect is an
 * optimisation; this is what actually keeps signed-out visitors out.
 */
/**
 * Every page inside the shell is specific to one signed-in creator, so none of
 * it may be prerendered or cached at the edge. Next.js 16 is dynamic by default,
 * but this makes the requirement explicit and survives a future `use cache`.
 */
export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser()

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:block">
        <div className="sticky top-0 h-dvh">
          <Sidebar />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar email={user.email ?? ''} displayName={displayNameFor(user)} />
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
