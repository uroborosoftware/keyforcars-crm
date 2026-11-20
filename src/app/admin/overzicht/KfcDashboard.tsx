import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, CircleEuro, Clock3, Package, ShoppingCart, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PreviewProductName, PreviewDate, PreviewText } from '../PreviewLanguage';
import { RevenueBars } from './KfcCharts';
import { MetricArc, PulseBars, SegmentBar, metricColors } from '../_ui/MetricVisuals';
import { SHOPS, SOLD, sampleCatalogue, sampleOrders, type SampleOrder } from '@/lib/kfcSampleOrders';
import { ordersForDashboard, sampleShopOrdersExist, shopOrdersExist } from '@/lib/kfcOrders';
import { rankProducts } from './productRanking';

/**
 * The KeyForCars owner's view: orders, revenue without VAT, units, which
 * shop, best sellers, and what has not sold. Margin waits for purchase prices.
 *
 * Reads the sample orders in the preview; the real install reads the
 * WooCommerce import, in the same shape.
 */

export type KfcPeriod = 'vandaag' | '7' | '30' | '90';
const PERIODS: { id: KfcPeriod; label: string; days: number }[] = [
  { id: 'vandaag', label: 'Vandaag', days: 1 },
  { id: '7', label: '7 dagen', days: 7 },
  { id: '30', label: '30 dagen', days: 30 },
  { id: '90', label: '90 dagen', days: 90 },
];

export function parseKfcPeriod(value: string | undefined): KfcPeriod {
  return PERIODS.some((p) => p.id === value) ? (value as KfcPeriod) : '30';
}

const TZ = 'Europe/Amsterdam';
const DAY = 86_400_000;
const dayFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, dateStyle: 'short' });
const hourFormatter = new Intl.DateTimeFormat('nl-NL', { hour: 'numeric', hourCycle: 'h23', timeZone: TZ });
export const dayKey = (time: number | string) => dayFormatter.format(new Date(time));
const hourOf = (iso: string) =>
  Number(hourFormatter.format(new Date(iso)));
const currencyFormatter = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const integerFormatter = new Intl.NumberFormat('nl-NL');
const euro = (cents: number) => currencyFormatter.format(cents / 100);
const number = (n: number) => integerFormatter.format(n);

interface Totals { orders: number; revenue: number; units: number }

function totals(orders: SampleOrder[]): Totals {
  return orders.reduce<Totals>(
    (sum, order) => ({
      orders: sum.orders + 1,
      revenue: sum.revenue + order.totalExcl,
      units: sum.units + order.lines.reduce((u, line) => u + line.quantity, 0),
    }),
    { orders: 0, revenue: 0, units: 0 },
  );
}

function Trend({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-muted-foreground text-xs"><PreviewText>geen vergelijking</PreviewText></span>;
  const change = Math.round(((now - before) / before) * 100);
  const up = change >= 0;
  return (
    <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${up ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {Math.abs(change)}% <span className="text-muted-foreground font-normal"><PreviewText>vs vorige periode</PreviewText></span>
    </span>
  );
}

function Kpi({ label, value, now, before, foot, strong, icon: Icon }: {
  label: string; value: string; now?: number; before?: number; foot: string; strong?: boolean; icon: LucideIcon;
}) {
  return (
    <Card className={strong ? 'kfc-kpi kfc-kpi-primary' : 'kfc-kpi'}>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center justify-between gap-2"><PreviewText>{label}</PreviewText><Icon className="size-4 shrink-0" aria-hidden /></CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {now !== undefined && before !== undefined && <Trend now={now} before={before} />}
        <span className="text-muted-foreground text-xs"><PreviewText>{foot}</PreviewText></span>
      </CardContent>
    </Card>
  );
}

/** Every figure on the dashboard, for this moment and period. */
async function readKfcDashboard(period: KfcPeriod) {
  const now = Date.now();
  const { days } = PERIODS.find((p) => p.id === period)!;
  const from = dayKey(now - (days - 1) * DAY);
  const prevFrom = dayKey(now - (2 * days - 1) * DAY);
  // Both checks and the order read start together; the read covers this period, the one before and 90 days for "not sold".
  const window = Math.max(2 * days, 90) + 1;
  const [live, hasSamples, liveOrders] = await Promise.all([
    shopOrdersExist().catch(() => false),
    sampleShopOrdersExist().catch(() => false),
    ordersForDashboard(window).catch(() => null),
  ]);
  const showSampleNotice = !live || hasSamples;
  if (live && !liveOrders) throw Error('Dashboard orders unavailable');
  const all = live ? liveOrders! : sampleOrders(now);
  const sold = all.filter(order => SOLD.includes(order.status)).map(order => ({ order, date: dayKey(order.created) }));
  const current = sold.filter(({ date }) => date >= from);
  const inPeriod = current.map(({ order }) => order);
  // The previous period up to the same moment, so "today so far" is not compared to a whole day.
  const prevCutoff = now - days * DAY;
  const before = sold
    .filter(({ date, order }) => date >= prevFrom && date < from && Date.parse(order.created) <= prevCutoff)
    .map(({ order }) => order);
  const cur = totals(inPeriod);
  const prev = totals(before);
  const onHold = all.filter((order) => order.status === 'on-hold' && dayKey(order.created) >= from).length;

  // Revenue over time: by hour today, by day up to 30 days, by week for 90.
  const bars: { label: string; value: number }[] = [];
  if (days === 1) {
    for (let hour = 8; hour <= 23; hour++) {
      const value = inPeriod.filter((o) => hourOf(o.created) === hour).reduce((s, o) => s + o.totalExcl, 0);
      bars.push({ label: `${hour}`, value: value / 100 });
    }
  } else if (days <= 30) {
    const revenueByDay = new Map<string, number>();
    for (const { order, date } of current) {
      revenueByDay.set(date, (revenueByDay.get(date) ?? 0) + order.totalExcl);
    }
    for (let d = days - 1; d >= 0; d--) {
      const key = dayKey(now - d * DAY);
      bars.push({ label: key.slice(8), value: (revenueByDay.get(key) ?? 0) / 100 });
    }
  } else {
    for (let w = 12; w >= 0; w--) {
      const end = now - w * 7 * DAY;
      const start = end - 7 * DAY;
      const value = inPeriod
        .filter((o) => Date.parse(o.created) > start && Date.parse(o.created) <= end)
        .reduce((s, o) => s + o.totalExcl, 0);
      bars.push({ label: dayKey(end).slice(5).replace('-', '/'), value: value / 100 });
    }
  }

  const byShop = SHOPS.map((shop) => ({
    label: shop,
    value: inPeriod.filter((o) => o.shop === shop).reduce((s, o) => s + o.totalExcl, 0),
  }));

  const best = rankProducts(inPeriod)
    .slice(0, 10)
    .map(({ sku, name, units }) => ({ sku, name, value: units }));

  // "Do not reorder": priced products without a single sale in 90 days.
  const ninety = dayKey(now - 89 * DAY);
  const soldRecently = new Set(sold.filter(({ date }) => date >= ninety).flatMap(({ order }) => order.lines.map(line => line.sku)));
  const catalogue = sampleCatalogue();
  const unsold = catalogue.filter((product) => !soldRecently.has(product.sku));

  const countries = new Map<string, number>();
  const activity = new Map<string, number>();
  for (const { date, order } of sold) {
    activity.set(date, (activity.get(date) ?? 0) + 1);
    if (date >= from && order.country) countries.set(order.country, (countries.get(order.country) ?? 0) + 1);
  }
  const pulse = Array.from({ length: 30 }, (_, index) => {
    const label = dayKey(now - (29 - index) * DAY);
    return { label, value: activity.get(label) ?? 0 };
  });
  const completed = inPeriod.filter((order) => order.status === 'completed').length;
  return { now, days, cur, prev, onHold, bars, byShop, best, unsold, catalogue, showSampleNotice, pulse, completed, countries: [...countries].sort((a, b) => b[1] - a[1]).slice(0, 6) };
}

/**
 * The owner's dashboard on shadcn: period switch, six KPIs, revenue over time,
 * revenue per shop, best sellers, and what has not sold in 90 days.
 */
export default async function KfcDashboard({ period }: { period: KfcPeriod; embedded?: boolean }) {
  const { now, days, cur, prev, onHold, bars, byShop, best, unsold, catalogue, showSampleNotice, pulse, completed, countries } = await readKfcDashboard(period);
  const topUnits = best[0]?.value ?? 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="kfc-dashboard-title font-semibold tracking-tight"><PreviewText>Dashboard</PreviewText></h1>
          <p className="text-muted-foreground text-sm"><PreviewDate value={now} /></p>
        </div>
        <div className="flex gap-1 rounded-lg border p-1">
          {PERIODS.map((p) => (
            <Button key={p.id} asChild size="sm" variant={p.id === period ? 'default' : 'ghost'}>
              <Link prefetch={false} href={`/admin/overzicht?webshop=${p.id}`}><PreviewText>{p.label}</PreviewText></Link>
            </Button>
          ))}
        </div>
      </div>

      {showSampleNotice && <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs">
        <PreviewText>Proefversie met voorbeeldbestellingen: echte producten en prijzen uit de webshops, verzonnen aantallen. In de echte versie komen hier de bestellingen van keyforcars.nl, klapsleutels.nl en remkeys.com binnen.</PreviewText>
      </p>}

      <div className="kfc-kpi-strip">
        <Kpi icon={ShoppingCart} label="Bestellingen" value={number(cur.orders)} now={cur.orders} before={prev.orders} foot="betaald of verzonden" />
        <Kpi icon={CircleEuro} strong label="Omzet excl. btw" value={euro(cur.revenue)} now={cur.revenue} before={prev.revenue} foot="producten en verzending, zonder 21% btw" />
        <Kpi icon={Package} label="Stuks verkocht" value={number(cur.units)} now={cur.units} before={prev.units} foot="alle drie de webshops" />
        <Kpi icon={TrendingUp} label="Gemiddelde bestelling" value={euro(cur.orders ? cur.revenue / cur.orders : 0)}
          now={cur.orders ? cur.revenue / cur.orders : 0} before={prev.orders ? prev.revenue / prev.orders : 0} foot="omzet excl. btw per bestelling" />
        <Kpi icon={Clock3} label="Wacht op betaling" value={number(onHold)} foot="bankoverschrijvingen nog niet binnen" />
        <Kpi icon={Wallet} label="Webshop afgerond" value={number(completed)} foot="in de gekozen periode" />
      </div>

      <div className="kfc-dashboard-charts">
        <Card className="min-w-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle><PreviewText>Omzet excl. btw</PreviewText></CardTitle>
              <CardDescription><PreviewText>{days === 1 ? 'per uur' : days <= 30 ? 'per dag' : 'per week'}</PreviewText></CardDescription>
            </div>
            <Button asChild variant="outline" size="sm"><Link href="/admin/orders"><PreviewText>Alle bestellingen →</PreviewText></Link></Button>
          </CardHeader>
          <CardContent><RevenueBars bars={bars} /></CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader><CardTitle><PreviewText>Omzet per webshop</PreviewText></CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <ul className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              {byShop.map((shop, index) => <li key={shop.label} className="min-w-0">
                <span className="flex items-center gap-1.5 break-all text-xs text-muted-foreground"><span className="size-2 shrink-0 rounded-full" style={{ background: metricColors[index] }} />{shop.label}</span>
                <strong className="text-lg tabular-nums">{euro(shop.value)}</strong>
                <span className="ml-1 text-xs text-muted-foreground">{cur.revenue > 0 ? Math.round(shop.value / cur.revenue * 100) : 0}%</span>
              </li>)}
            </ul>
            <SegmentBar values={byShop} label="Revenue per webshop / Omzet per webshop" />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader><CardTitle><PreviewText>Bestelactiviteit</PreviewText></CardTitle><CardDescription><PreviewText>Afgelopen 30 dagen</PreviewText></CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <PulseBars values={pulse} label="Daily order counts / Dagelijkse bestellingen" />
            <p className="text-xs text-muted-foreground"><PreviewText>Bestellingen per land in de gekozen periode</PreviewText></p>
            <dl className="grid gap-x-5 sm:grid-cols-2">{countries.map(([country, count]) => <div key={country} className="flex items-center justify-between border-t py-2 text-sm"><dt>{country}</dt><dd className="tabular-nums">{number(count)}</dd></div>)}</dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><PreviewText>Webshop afgerond</PreviewText></CardTitle><CardDescription>{number(completed)} / {number(cur.orders)} <PreviewText>bestellingen</PreviewText></CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <MetricArc value={cur.orders ? Math.round(completed / cur.orders * 100) : 0} label="" />
            <Link prefetch={false} className="text-sm font-medium text-primary" href="/admin/orders?status=completed"><PreviewText>Bekijk afgeronde bestellingen</PreviewText> →</Link>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle><PreviewText>Best verkocht (stuks)</PreviewText></CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/admin/best-verkocht"><PreviewText>Bekijk ranglijst</PreviewText></Link></Button>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2.5">
              {best.map((row) => (
                <li key={row.sku} className="grid min-w-0 gap-1 text-sm">
                  <div className="flex min-w-0 justify-between gap-4"><span className="min-w-0 truncate">{row.sku} · <PreviewProductName sku={row.sku}>{row.name}</PreviewProductName></span><span className="font-medium tabular-nums">{number(row.value)}</span></div>
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full"><div className="bg-primary h-full rounded-full" style={{ width: `${Math.max(3, (row.value / topUnits) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle><PreviewText>Niet verkocht in 90 dagen</PreviewText> · {number(unsold.length)} / {number(catalogue.length)}</CardTitle>
              <CardDescription><PreviewText>Niet bijbestellen zonder eerst te tellen. Dit zijn de eerste 12.</PreviewText></CardDescription>
            </div>
            <Button asChild variant="outline" size="sm"><Link href="/admin/voorraad"><PreviewText>Naar de voorraad →</PreviewText></Link></Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead><PreviewText>Product</PreviewText></TableHead><TableHead className="text-right"><PreviewText>Prijs</PreviewText></TableHead></TableRow></TableHeader>
              <TableBody>
                {unsold.slice(0, 12).map((product) => (
                  <TableRow key={product.sku}>
                    <TableCell><Link prefetch={false} className="font-medium underline-offset-4 hover:underline" href={`/admin/voorraad/p/${encodeURIComponent(product.sku)}`}>{product.sku}</Link></TableCell>
                    <TableCell><PreviewProductName sku={product.sku}>{product.name}</PreviewProductName></TableCell>
                    <TableCell className="text-right tabular-nums">{euro(product.price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
