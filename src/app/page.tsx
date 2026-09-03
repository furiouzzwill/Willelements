import { redirect } from 'next/navigation'

/** Local app — there is no marketing page and no sign-in. Go straight in. */
export default function RootPage() {
  redirect('/dashboard')
}
