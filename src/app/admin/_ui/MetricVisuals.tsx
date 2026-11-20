import type { CSSProperties } from 'react';

export const metricColors = ['#365bc7', '#177e73', '#a25d25', '#8056ae', '#577887'];

export function SegmentBar({ values, label }: { values: { label: string; value: number }[]; label: string }) {
  const total = values.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  return <div role="img" aria-label={label} className="flex h-3 gap-1 overflow-hidden rounded-md bg-muted">
    {values.map((item, index) => item.value > 0 && (
      <span key={item.label} title={item.label} className="rounded-[3px]" style={{ width: `${item.value / total * 100}%`, backgroundColor: metricColors[index % metricColors.length] }} />
    ))}
  </div>;
}

export function PulseBars({ values, label, dense = false }: { values: { label: string; value: number }[]; label: string; dense?: boolean }) {
  const max = Math.max(1, ...values.map((point) => point.value));
  return <div role="img" aria-label={label} className={`flex items-end ${dense ? 'h-8 gap-[3px]' : 'h-24 gap-1.5'}`}>
    {values.map((point) => <span key={point.label} title={point.label + ' · ' + point.value}
      className={`min-w-0 flex-1 rounded-sm ${point.value === 0 ? 'bg-muted' : point.value === max ? 'bg-[#365bc7]' : 'bg-[#9db5f1]'}`}
      style={{ height: `${Math.max(dense ? 20 : 3, point.value / max * 100)}%` }} />)}
  </div>;
}

export function MetricArc({ value, label }: { value: number; label: string }) {
  const ratio = Math.min(100, Math.max(0, value));
  return <div className="kfc-metric-arc" role="img" aria-label={label + ' ' + ratio + '%'} style={{ '--metric-arc': `${ratio * 1.8}deg` } as CSSProperties}>
    <strong className="text-3xl font-semibold tabular-nums">{ratio}%</strong>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>;
}

export function ActivityLine({ values, label }: { values: number[]; label: string }) {
  const top = Math.max(1, ...values);
  const points = values.map((value, index) => [
    Math.round(index / Math.max(1, values.length - 1) * 300), 38 - Math.round(value / top * 34),
  ].join(',')).join(' ');
  return <svg role="img" aria-label={label} viewBox="0 0 300 40" preserveAspectRatio="none" className="h-10 w-full">
    <polygon fill="#365bc7" fillOpacity={0.12} points={`0,40 ${points} 300,40`} />
    <polyline fill="none" stroke="#365bc7" strokeWidth={1.5} vectorEffect="non-scaling-stroke" points={points} />
  </svg>;
}
