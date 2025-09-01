type Props = { kind: string }
export default function WrinkleBadge({ kind }: Props) {
  const label = ({
    bonus: 'Bonus Game',
    spread: 'Bonus vs Spread',
    oof: 'OOF Bonus',
    winless_double: 'Winless Double',
  } as Record<string,string>)[String(kind).toLowerCase()] || kind
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300/60 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
      {label}
    </span>
  )
}
