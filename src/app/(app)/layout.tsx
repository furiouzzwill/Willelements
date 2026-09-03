import { Sidebar } from '@/components/shell/sidebar'
import { Topbar } from '@/components/shell/topbar'
import { getDefaultBrand } from '@/lib/services/brand-service'

/**
 * Application shell.
 *
 * Every page reads local state that changes as you use the app, so nothing here
 * is prerendered at build time.
 */
export const dynamic = 'force-dynamic'

export default function AppLayout({ children }: LayoutProps<'/'>) {
  const brand = getDefaultBrand()

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:block">
        <div className="sticky top-0 h-dvh">
          <Sidebar />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar brandName={brand?.name ?? null} />
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
