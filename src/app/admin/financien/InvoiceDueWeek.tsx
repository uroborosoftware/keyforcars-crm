'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePreviewLanguage } from '../PreviewLanguage';

type InvoiceDue = { id: number; date: string; href: string; label: string; amount: number };

export function InvoiceDueWeek({ days, invoices }: { days: string[]; invoices: InvoiceDue[] }) {
  const [selectedDay, setSelectedDay] = useState(days[0]);
  const { english } = usePreviewLanguage();
  const locale = english ? 'en-GB' : 'nl-NL';
  const money = new Intl.NumberFormat(locale, { currency: 'EUR', style: 'currency' });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const rows = invoices.filter((invoice) => invoice.date === selectedDay);
  const sum = (items: InvoiceDue[]) => items.reduce((total, invoice) => total + invoice.amount, 0);

  return <div className="grid gap-3">
    <div className="text-2xl font-semibold tabular-nums">{money.format(sum(invoices) / 100)}</div>
    <p className="text-xs text-muted-foreground">{english ? 'Outstanding within the next 7 days' : 'Openstaand in de komende 7 dagen'}</p>
    <div role="group" aria-label={english ? 'Invoice due date' : 'Vervaldatum factuur'} className="grid grid-cols-7 gap-1">
      {days.map((day) => <button key={day} type="button" aria-label={date.format(new Date(day))} aria-pressed={day === selectedDay} onClick={() => setSelectedDay(day)}
        className="grid justify-items-center gap-1 rounded-md border border-transparent px-0.5 py-1.5 text-xs hover:bg-muted aria-pressed:border-border aria-pressed:bg-muted">
        <span className="text-muted-foreground">{weekday.format(new Date(day))}</span><strong className="tabular-nums">{day.slice(-2)}</strong>
        <span aria-hidden className={`size-1 rounded-full ${invoices.some((invoice) => invoice.date === day) ? 'bg-primary' : 'bg-transparent'}`} />
      </button>)}
    </div>
    {rows.length ? <div className="grid gap-1">
      {rows.map((row) => <Link prefetch={false} href={row.href} key={row.id} className="flex justify-between gap-2 border-t py-2 text-sm hover:text-primary">
        <span>{row.label}</span><span className="tabular-nums">{money.format(row.amount / 100)}</span>
      </Link>)}
    </div> : <p className="text-xs text-muted-foreground">{english ? 'No open invoices due on this day.' : 'Geen openstaande facturen met deze vervaldatum.'}</p>}
  </div>;
}
