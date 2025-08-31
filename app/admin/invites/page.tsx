import InviteWidget from '@/components/admin/InviteWidget'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export default function AdminInvitesPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight mb-6">Invite Members</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
        Choose a league you own/admin, create invite links (optionally restricted to an email), and revoke as needed.
      </p>
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <InviteWidget />
      </section>
    </main>
  )
}
