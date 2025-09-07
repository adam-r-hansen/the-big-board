import Link from 'next/link'
import RunScoresRefresh from './run-scores-refresh'

export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-xl font-bold mb-4">Admin</h1>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Operations</h2>
            <span className="text-xs text-neutral-500">Safe server actions</span>
          </header>
          <RunScoresRefresh />
        </div>

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <header className="mb-3">
            <h2 className="text-lg font-semibold">Tools</h2>
          </header>
          <ul className="space-y-2 text-sm">
            <li><Link className="underline" href="/admin/health">Health Checks</Link></li>
            <li><Link className="underline" href="/admin/teams">Teams</Link> <span className="text-neutral-500">— UI colors</span></li>
            <li><Link className="underline" href="/admin/leagues">Leagues</Link> <span className="text-neutral-500">— create/view</span></li>
            <li><Link className="underline" href="/admin/wrinkles">Wrinkles</Link></li>
          </ul>
        </div>
      </section>
    </main>
  )
}
