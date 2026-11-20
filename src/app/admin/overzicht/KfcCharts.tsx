const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function RevenueBars({ bars }: { bars: { label: string; value: number }[] }) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const tickStep = Math.max(1, Math.ceil(bars.length / 8));
  return <figure className="m-0 grid gap-2">
    <div className="relative flex h-44 items-end gap-1.5 border-b bg-[repeating-linear-gradient(to_top,var(--border)_0px,var(--border)_1px,transparent_1px,transparent_25%)]">
      {bars.map((bar, index) => <span key={index} className="min-w-0 flex-1 rounded-t bg-[#365bc7] opacity-80 hover:opacity-100"
        title={`${bar.label} · ${euro.format(bar.value)}`} style={{ height: `${Math.max(bar.value / max * 100, 1)}%` }} />)}
    </div>
    <figcaption className="flex justify-between gap-1 text-[11px] text-muted-foreground">
      {bars.map((bar, index) => (index % tickStep === 0 || index === bars.length - 1) && <span key={index}>{bar.label}</span>)}
    </figcaption>
    <ul className="sr-only">{bars.map((bar, index) => <li key={index}>{bar.label} · {euro.format(bar.value)}</li>)}</ul>
  </figure>;
}
