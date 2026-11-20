'use client';

import { PreviewText } from '@/app/admin/PreviewLanguage';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Clock, Download, FileText, Search, Send, X } from 'lucide-react';
import styles from './facturen-list.module.css';
import { IS_KEYFORCARS } from '@/config/install';
import { invoiceDay, invoiceDueDate as dueDate, invoiceToday, PAYMENT_REMINDER_DAYS, PAYMENT_TERM_DAYS } from '@/lib/invoiceDue';
import { usePreviewLanguage } from '../PreviewLanguage';
import { Button } from '@/components/ui/button';

const MONEY = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const DATE = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

interface InvoiceRow {
  id: string;
  invoice_number: string;
  issue_date: string;
  client_name: string;
  client_city: string | null;
  client_email: string | null;
  client_phone: string | null;
  total: number | string;
  status: 'concept' | 'verzonden' | 'betaald';
  technician_name: string | null;
  logo: string | null;
  job?: {
    id: string;
    car_make: string | null;
    car_model: string | null;
    kenteken: string | null;
    service_type: string | null;
  } | null;
}

const isOverdue = (row: { status: string; issue_date: string }) => row.status === 'verzonden' &&
  invoiceDay(row.issue_date) + PAYMENT_TERM_DAYS < invoiceDay(invoiceToday());

function StatusPill({ row, status }: { row: InvoiceRow; status?: InvoiceRow['status'] }) {
  const st = status ?? row.status;
  if (st === 'betaald') return <span className={`${styles.pill} ${styles.pillPaid}`}><PreviewText>{"Betaald"}</PreviewText></span>;
  if (st === 'concept') return <span className={`${styles.pill} ${styles.pillDraft}`}><PreviewText>{"Concept"}</PreviewText></span>;
  if (isOverdue({ status: st, issue_date: row.issue_date })) return <span className={`${styles.pill} ${styles.pillLate}`}><PreviewText>{"Te laat"}</PreviewText></span>;
  return <span className={`${styles.pill} ${styles.pillOpen}`}><PreviewText>{"Openstaand"}</PreviewText></span>;
}

const carOf = (row: InvoiceRow) => (row.job ? [row.job.car_make, row.job.car_model].filter(Boolean).join(' ') || 'Auto' : null);

/** The selected invoice: status buttons, PDF, and the essentials. */
function Drawer({ invoice, onClose, showTechnician }: { invoice: InvoiceRow; onClose: () => void; showTechnician: boolean }) {
  /* Held locally so the drawer reflects the change at once; the list row is
     server-rendered and updates on the next load. Rolled back on failure. */
  const [status, setStatusLocal] = useState(invoice.status);
  const [busy, setBusy] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);

  async function setStatus(next: InvoiceRow['status']) {
    const previous = status;
    setStatusLocal(next);
    setBusy(next);
    setSaveError(false);
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setStatusLocal(previous);
      setSaveError(true);
    } finally {
      setBusy(null);
    }
  }

  const overdue = isOverdue({ status, issue_date: invoice.issue_date });
  const car = carOf(invoice);

  return (
    <aside className={styles.drawer} aria-label={`Factuur ${invoice.invoice_number}`}>
      <div className={styles.drawerHead}>
        <div>
          <span className={styles.drawerLabel}><PreviewText>{"Factuur"}</PreviewText></span>
          <h2 className={styles.drawerTitle}>{invoice.invoice_number}</h2>
        </div>
        <StatusPill row={invoice} status={status} />
        <button type="button" className={styles.close} onClick={onClose} aria-label="Sluiten">
          <X size={18} />
        </button>
      </div>

      <div className={styles.drawerActions}>
        <button type="button" className={styles.btnPrimary} disabled={busy !== null || status !== 'concept'} onClick={() => setStatus('verzonden')}>
          <Send size={15} /> <PreviewText>{busy === 'verzonden' ? 'Bezig…' : 'Verzonden'}</PreviewText>
        </button>
        <button type="button" className={styles.btnOk} disabled={busy !== null || status === 'betaald'} onClick={() => setStatus('betaald')}>
          <CheckCircle size={15} /> <PreviewText>{busy === 'betaald' ? 'Bezig…' : 'Betaald'}</PreviewText>
        </button>
        <Link href={`/admin/facturen/${invoice.id}`} className={styles.btnGhost}>
          <Download size={15} /> PDF
        </Link>
      </div>
      {saveError && <p className={styles.error}>Opslaan mislukt, de status is niet veranderd.</p>}

      <dl className={styles.facts}>
        <div>
          <dt><PreviewText>{"Klant"}</PreviewText></dt>
          <dd>
            {invoice.client_name}
            {invoice.client_city && <span>{invoice.client_city}</span>}
            {invoice.client_phone && <span>{invoice.client_phone}</span>}
          </dd>
        </div>
        {car && (
          <div>
            <dt><PreviewText>{"Auto"}</PreviewText></dt>
            <dd>
              {car}
              <span>
                {[invoice.job?.kenteken, invoice.job?.service_type].filter(Boolean).join(' · ') || '—'}
              </span>
            </dd>
          </div>
        )}
        {showTechnician && (
          <div>
            <dt>Op naam van monteur</dt>
            <dd>{invoice.technician_name ?? <span>geen</span>}</dd>
          </div>
        )}
        <div>
          <dt><PreviewText>{"Factuurdatum"}</PreviewText></dt>
          <dd>{DATE.format(new Date(invoice.issue_date))}</dd>
        </div>
        <div>
          <dt>Vervaldatum</dt>
          <dd className={overdue ? styles.lateText : undefined}>{DATE.format(dueDate(invoice.issue_date))}</dd>
        </div>
      </dl>

      <div className={overdue ? `${styles.total} ${styles.totalLate}` : styles.total}>
        <span><PreviewText>{status === 'betaald' ? 'Betaald' : 'Openstaand'}</PreviewText></span>
        <b>{MONEY.format(Number(invoice.total))}</b>
      </div>

      <Link href={`/admin/facturen/${invoice.id}/bewerken`} className={styles.editLink}>
        Factuur bewerken →
      </Link>
    </aside>
  );
}

type Filter = 'alle' | 'concept' | 'open' | 'laat' | 'betaald';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'concept', label: 'Concept' },
  { id: 'open', label: 'Openstaand' },
  { id: 'laat', label: 'Te laat' },
  { id: 'betaald', label: 'Betaald' },
];

export default function FacturenTable({ rows, showTechnician = false }: { rows: InvoiceRow[]; showTechnician?: boolean }) {
  const { english, t } = usePreviewLanguage();
  const today = invoiceDay(invoiceToday());
  const dueSoon = IS_KEYFORCARS && showTechnician ? rows.filter(row => {
    const days = invoiceDay(row.issue_date) + PAYMENT_TERM_DAYS - today;
    return row.status === 'verzonden' && days >= 0 && days <= PAYMENT_REMINDER_DAYS;
  }).length : 0;
  const [selected, setSelected] = useState<InvoiceRow | null>(null);
  const [filter, setStatusFilter] = useState<Filter>('alle');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ by: 'due' | 'amount'; ascending: boolean }>({ by: 'due', ascending: false });
  const setFilter = (value: Filter) => { setStatusFilter(value); setPage(1); };
  const changeSort = (by: 'due' | 'amount') => {
    setSort((current) => ({ by, ascending: current.by === by && !current.ascending }));
    setPage(1);
  };

  const m = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const sum = (list: InvoiceRow[]) => list.reduce((t, r) => t + (Number(r.total) || 0), 0);
    const open = rows.filter((r) => r.status === 'verzonden' && !isOverdue(r));
    const late = rows.filter((r) => isOverdue(r));
    const paid = rows.filter((r) => r.status === 'betaald');
    const paidThis = paid.filter((r) => new Date(r.issue_date) >= monthStart);
    const paidPrev = paid.filter((r) => {
      const d = new Date(r.issue_date);
      return d >= prevStart && d < monthStart;
    });
    return {
      open: { n: open.length, sum: sum(open) },
      late: { n: late.length, sum: sum(late) },
      concept: rows.filter((r) => r.status === 'concept').length,
      paidThis: sum(paidThis),
      paidPrev: sum(paidPrev),
    };
  }, [rows]);

  const change = m.paidPrev > 0 ? Math.round(((m.paidThis - m.paidPrev) / m.paidPrev) * 100) : null;

  const term = search.trim().toLowerCase();
  const list = rows.filter((r) => {
    if (term && !`${r.invoice_number} ${r.client_name ?? ''} ${r.client_city ?? ''}`.toLowerCase().includes(term)) return false;
    if (filter === 'concept') return r.status === 'concept';
    if (filter === 'open') return r.status === 'verzonden' && !isOverdue(r);
    if (filter === 'laat') return isOverdue(r);
    if (filter === 'betaald') return r.status === 'betaald';
    return true;
  }).sort((a, b) => (sort.ascending ? 1 : -1) * (sort.by === 'amount' ? Number(a.total) - Number(b.total) : a.issue_date.localeCompare(b.issue_date)));
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = list.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const locale = english ? 'en-GB' : 'nl-NL';
  const dueFormatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const moneyFormatter = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' });

  function exportCsv() {
    const field = (value: string) => '"' + (/^[\s]*[=+@\-]/.test(value) ? "'" : '') + value.replaceAll('"', '""') + '"';
    const columns = english ? ['Invoice', 'Customer', 'Status', 'Due date', 'Amount (EUR)'] : ['Factuur', 'Klant', 'Status', 'Vervaldatum', 'Bedrag (EUR)'];
    const data = list.map((row) => [
      row.invoice_number, row.client_name || '', t(row.status === 'betaald' ? 'Betaald' : row.status === 'concept' ? 'Concept' : isOverdue(row) ? 'Te laat' : 'Openstaand'),
      dueDate(row.issue_date).toISOString().slice(0, 10), String(Number(row.total)),
    ]);
    const blob = new Blob(['\uFEFF', [columns, ...data].map((record) => record.map(field).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'keyforcars-invoices.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      {dueSoon > 0 && <p><Link href="/admin/bank/verwacht">
        {english ? `${dueSoon} due within ${PAYMENT_REMINDER_DAYS} days · View Expected Payments` : `${dueSoon} binnen ${PAYMENT_REMINDER_DAYS} dagen · Bekijk Verwachte Betalingen`}
      </Link></p>}
      <div className={styles.metrics}>
        <button type="button" className={filter === 'open' ? styles.metricOn : styles.metric} onClick={() => setFilter('open')}>
          <span className={styles.metricLabel}><FileText size={15} /> <PreviewText>{"Openstaand"}</PreviewText></span>
          <b>{MONEY.format(m.open.sum)}</b>
          <span>{m.open.n} <PreviewText>{"facturen"}</PreviewText></span>
        </button>
        <button type="button" className={filter === 'laat' ? styles.metricOn : styles.metric} onClick={() => setFilter('laat')}>
          <span className={styles.metricLabel}><Clock size={15} /> <PreviewText>{"Te laat"}</PreviewText></span>
          <b className={m.late.n ? styles.lateText : undefined}>{MONEY.format(m.late.sum)}</b>
          <span>{m.late.n ? `${m.late.n} ${t('facturen')} · ${t('bel of stuur een herinnering')}` : t('niets te laat')}</span>
        </button>
        <button type="button" className={filter === 'betaald' ? styles.metricOn : styles.metric} onClick={() => setFilter('betaald')}>
          <span className={styles.metricLabel}><CheckCircle size={15} /> <PreviewText>{"Betaald deze maand"}</PreviewText></span>
          <b>{MONEY.format(m.paidThis)}</b>
          <span>
            {change === null ? t('geen vergelijking met vorige maand') : `${change >= 0 ? '↑' : '↓'} ${Math.abs(change)}% ${t("vs vorige maand")}`}
          </span>
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={filter === f.id ? styles.filterOn : styles.filter} onClick={() => setFilter(f.id)}>
              {t(f.label)}
              {f.id === 'concept' && m.concept > 0 && <span className={styles.count}>{m.concept}</span>}
              {f.id === 'laat' && m.late.n > 0 && <span className={`${styles.count} ${styles.countLate}`}>{m.late.n}</span>}
            </button>
          ))}
        </div>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input type="search" placeholder={t("Factuurnummer, klant of plaats")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label={t("Zoek factuur")} />
        </label>
        <Button variant="outline" size="sm" type="button" onClick={exportCsv} disabled={!list.length}><Download aria-hidden />{english ? 'Export CSV' : 'CSV exporteren'}</Button>
      </div>

      <div className={selected ? `${styles.layout} ${styles.layoutOpen}` : styles.layout}>
        <div className={styles.table} role="table" aria-label={t("Facturen")}>
          <div className={`${styles.row} ${styles.head} ${showTechnician ? styles.withTech : ''}`} role="row">
            <span role="columnheader">{t("Nummer")}</span>
            <span role="columnheader"><PreviewText>{"Klant"}</PreviewText></span>
            <span role="columnheader">{t("Auto / klus")}</span>
            {showTechnician && <span role="columnheader" className={styles.colTech}><PreviewText>{"Monteur"}</PreviewText></span>}
            <span role="columnheader" aria-sort={sort.by === 'amount' ? sort.ascending ? 'ascending' : 'descending' : 'none'} className={styles.num}>
              <button type="button" onClick={() => changeSort('amount')}>{t('Bedrag')} {sort.by === 'amount' ? sort.ascending ? '↑' : '↓' : '↕'}</button>
            </span>
            <span role="columnheader" aria-sort={sort.by === 'due' ? sort.ascending ? 'ascending' : 'descending' : 'none'} className={styles.colDue}>
              <button type="button" onClick={() => changeSort('due')}>{t("Vervalt")} {sort.by === 'due' ? sort.ascending ? '↑' : '↓' : '↕'}</button>
            </span>
            <span role="columnheader">Status</span>
          </div>
          {list.length === 0 && <p className={styles.empty}>{t("Geen facturen gevonden.")}</p>}
          {visible.map((row) => {
            const car = carOf(row);
            const late = isOverdue(row);
            return (
              <button
                key={row.id}
                type="button"
                role="row"
                className={`${styles.row} ${showTechnician ? styles.withTech : ''} ${selected?.id === row.id ? styles.rowOn : ''}`}
                onClick={() => setSelected(row)}
              >
                <span className={styles.nr}>{row.invoice_number}</span>
                <span className={styles.client}>
                  <b>{row.client_name}</b>
                  <small>{row.client_city || '—'}</small>
                </span>
                <span className={styles.car}>
                  {row.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.logo} alt="" />
                  ) : (
                    <i aria-hidden="true" />
                  )}
                  <span>
                    <b>{car ?? 'Dienst'}</b>
                    <small>{row.job?.service_type || '—'}</small>
                  </span>
                </span>
                {showTechnician && <span className={`${styles.tech} ${styles.colTech}`}>{row.technician_name ?? '—'}</span>}
                <span className={`${styles.num} ${styles.amount}`}>{moneyFormatter.format(Number(row.total))}</span>
                <span className={`${late ? styles.lateText : styles.due} ${styles.colDue}`}>{dueFormatter.format(dueDate(row.issue_date))}</span>
                <span>
                  <StatusPill row={row} />
                </span>
              </button>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
            <span>{list.length} {t('facturen')}</span>
            <div className="flex items-center gap-2">
              <select aria-label={english ? 'Invoices per page' : 'Facturen per pagina'} className="rounded-md border bg-card px-2 py-1" value={pageSize}
                onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                {[5, 10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <span>{currentPage} / {pages}</span>
              <Button variant="outline" size="sm" aria-label={english ? 'Previous page' : 'Vorige pagina'} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>‹</Button>
              <Button variant="outline" size="sm" aria-label={english ? 'Next page' : 'Volgende pagina'} disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>›</Button>
            </div>
          </div>
        </div>

        {selected && <Drawer key={selected.id} invoice={selected} onClose={() => setSelected(null)} showTechnician={showTechnician} />}
      </div>
    </>
  );
}
