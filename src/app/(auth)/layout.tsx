import Link from 'next/link'

import { Wordmark } from '@/components/ui/icon'

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="aurora flex min-h-dvh flex-col">
      <header className="px-6 py-6">
        <Link href="/">
          <Wordmark />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
