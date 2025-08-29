import type { ReactNode } from 'react'

export default function Card({
  title, action, children,
}: { title?: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title ? <h2 className="text-base font-semibold">{title}</h2> : <span />}
          {action}
        </header>
      )}
      <div>{children}</div>
    </section>
  )
}
