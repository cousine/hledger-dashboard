import { DashboardContext } from '../hledger/types';
import { HledgerClient } from '../hledger/client';
import { buildKpiRow, buildKpiCard } from '../ui/kpi';
import { createPaginatedTable, Row } from '../ui/table';
import { createBarChart } from '../ui/chart';
import { formatAmount } from '../format';
import { matchPattern } from '../filters';

function extractMonthlyAmounts(stdout: string): { months: string[]; amounts: number[] } {
  const report = JSON.parse(stdout);
  const r = Array.isArray(report) ? report[0] : report;
  if (!r || !r.prDates || !r.prRows) return { months: [], amounts: [] };
  const months = r.prDates.map((dp: any) => {
    const d = dp[0]?.contents || '';
    return d.substring(0, 7);
  });
  const amounts = new Array(months.length).fill(0);
  for (const row of r.prRows) {
    for (let i = 0; i < row.prrAmounts.length && i < months.length; i++) {
      const amtPairs = row.prrAmounts[i];
      if (Array.isArray(amtPairs)) {
        amounts[i] += amtPairs.reduce((s: number, a: any) => s + Math.abs(a.aquantity?.floatingPoint ?? 0), 0);
      }
    }
  }
  return { months, amounts };
}

interface TransferLeg {
  date: string;
  description: string;
  account: string;
  amount: number;
  commodity: string;
}

function parsePrintTransfers(stdout: string): TransferLeg[] {
  const raw: any[] = JSON.parse(stdout);
  if (!Array.isArray(raw)) return [];

  const legs: TransferLeg[] = [];

  for (const t of raw) {
    if (!t || !t.tpostings) continue;
    const date = t.tdate || '';
    const desc = t.tdescription || '';

    for (const p of t.tpostings) {
      const acct: string = p.paccount || '';
      if (acct === 'equity:transfer') continue;
      if (!p.pamount || !p.pamount.length) continue;

      const amt = p.pamount[0];
      const floatingPoint = amt?.aquantity?.floatingPoint;
      if (typeof floatingPoint !== 'number' || floatingPoint === 0) continue;

      legs.push({
        date,
        description: desc,
        account: acct,
        amount: floatingPoint,
        commodity: amt?.acommodity || '',
      });
    }
  }

  return legs;
}

let directionFilter: 'all' | 'out' | 'in' = 'all';

interface CachedTransferData {
  xLegs: TransferLeg[];
  nativeLegs: TransferLeg[];
  monthlyStdout: string;
  eligibleLegKeys: Set<string>;
  cacheKey: string;
}

let cachedData: CachedTransferData | null = null;

function makeCacheKey(ctx: DashboardContext): string {
  return JSON.stringify({
    accounts: ctx.filter.accountPatterns.slice().sort(),
    currencies: ctx.filter.currencies.slice().sort(),
    period: ctx.period.hledgerPeriod,
  });
}

export async function renderTransfers(
  container: HTMLElement,
  client: HledgerClient,
  ctx: DashboardContext
): Promise<void> {
  directionFilter = ctx.uiState?.directionFilter ?? 'all';
  const parentEl = container.parentElement as HTMLElement | null;
  const savedScroll = parentEl?.scrollTop ?? 0;
  container.empty();
  container.createEl('h2', { text: 'Transfers' });

  const cacheKey = makeCacheKey(ctx);

  let xLegs: TransferLeg[];
  let nativeLegs: TransferLeg[];
  let monthlyStdout: string;
  let eligibleLegKeys: Set<string>;

  if (cachedData && cachedData.cacheKey === cacheKey) {
    xLegs = cachedData.xLegs;
    nativeLegs = cachedData.nativeLegs;
    monthlyStdout = cachedData.monthlyStdout;
    eligibleLegKeys = cachedData.eligibleLegKeys;
  } else {
    const basePrintArgs: string[] = [
      'print', 'equity:transfer',
      '-p', ctx.period.hledgerPeriod,
      '-O', 'json',
    ];

    const [mStdout, pXStdout, pNStdout] = await Promise.all([
      client.exec(ctx.settings.hledgerPath, [
        'balance', 'equity:transfer',
        '--monthly',
        '-X', ctx.targetCurrency,
        '-p', ctx.period.hledgerPeriod,
        '-O', 'json',
      ], ctx.settings.journalFile),
      client.exec(ctx.settings.hledgerPath, [
        ...basePrintArgs,
        '-X', ctx.targetCurrency,
      ], ctx.settings.journalFile),
      client.exec(ctx.settings.hledgerPath, basePrintArgs, ctx.settings.journalFile),
    ]);

    const nLegs = parsePrintTransfers(pNStdout);

    const elKeys = new Set<string>();
    if (ctx.filter.currencies.length === 0) {
      for (const l of nLegs) elKeys.add(`${l.date}|${l.description}|${l.account}`);
    } else {
      for (const l of nLegs) {
        if (ctx.filter.currencies.includes(l.commodity)) {
          elKeys.add(`${l.date}|${l.description}|${l.account}`);
        }
      }
    }

    xLegs = parsePrintTransfers(pXStdout);
    nativeLegs = nLegs;
    monthlyStdout = mStdout;
    eligibleLegKeys = elKeys;

    cachedData = { xLegs, nativeLegs, monthlyStdout, eligibleLegKeys, cacheKey };
  }

  // Filter X legs by currency (match on date+description+account)
  let filtered = xLegs.filter(l => eligibleLegKeys.has(`${l.date}|${l.description}|${l.account}`));

  // Filter by account patterns
  if (ctx.filter.accountPatterns.length > 0) {
    filtered = filtered.filter(l =>
      ctx.filter.accountPatterns.some(p => matchPattern(l.account, p))
    );
  }

  // Filter by direction (local state, not global filter)
  if (directionFilter !== 'all') {
    filtered = filtered.filter(l => (l.amount < 0 ? 'out' : 'in') === directionFilter);
  }

  // KPI from unfiltered X legs (all transfers in period)
  const totalAbsVolume = xLegs.reduce((s, l) => s + Math.abs(l.amount), 0);
  const totalCount = xLegs.length;
  const avgAmount = totalCount > 0 ? totalAbsVolume / totalCount : 0;

  const kpiRow = buildKpiRow(container);
  buildKpiCard(kpiRow, 'Total Volume', formatAmount(totalAbsVolume / 2, ctx.targetCurrency), '');
  buildKpiCard(kpiRow, 'Count', String(totalCount), '');
  buildKpiCard(kpiRow, 'Average', formatAmount(avgAmount, ctx.targetCurrency), '');

  // Monthly chart
  const monthly = extractMonthlyAmounts(monthlyStdout);
  if (monthly.months.length > 1) {
    const monthLabels = monthly.months.map(m => {
      const parts = m.split('-');
      return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(parts[1]) - 1] || m;
    });
    container.createEl('br');
    container.createEl('h3', { text: 'Monthly Transfer Volume' });
    const chartContainer = container.createDiv({ cls: 'hldg-chart-mount' });
    createBarChart(chartContainer, monthLabels, [
      {
        label: 'Transfer Volume',
        data: monthly.amounts,
        backgroundColor: '#7aa2f7',
      },
    ]);
  }

  if (filtered.length > 0) {
    container.createEl('br');
    container.createEl('h3', { text: 'Transfer History' });
    const toggleRow = container.createDiv({ cls: 'hldg-view-toggle-row' });
    toggleRow.createSpan({ text: 'Direction:', cls: 'hldg-view-toggle-label' });
    const allBtn = toggleRow.createEl('button', {
      cls: `hldg-view-toggle-btn${directionFilter === 'all' ? ' hldg-view-toggle-active' : ''}`,
      text: 'All',
    });
    allBtn.addEventListener('click', () => {
      if (directionFilter !== 'all') { directionFilter = 'all'; ctx.onUIStateChange?.({ directionFilter: 'all' }); renderTransfers(container, client, ctx); }
    });
    const outBtn = toggleRow.createEl('button', {
      cls: `hldg-view-toggle-btn${directionFilter === 'out' ? ' hldg-view-toggle-active' : ''}`,
      text: 'Out',
    });
    outBtn.addEventListener('click', () => {
      if (directionFilter !== 'out') { directionFilter = 'out'; ctx.onUIStateChange?.({ directionFilter: 'out' }); renderTransfers(container, client, ctx); }
    });
    const inBtn = toggleRow.createEl('button', {
      cls: `hldg-view-toggle-btn${directionFilter === 'in' ? ' hldg-view-toggle-active' : ''}`,
      text: 'In',
    });
    inBtn.addEventListener('click', () => {
      if (directionFilter !== 'in') { directionFilter = 'in'; ctx.onUIStateChange?.({ directionFilter: 'in' }); renderTransfers(container, client, ctx); }
    });
    const rows: Row[] = filtered.map(l => [
      l.date,
      l.description,
      {
        text: l.account.replace('assets:bank:', ''),
        cls: 'hldg-clickable-account',
        onClick: () => ctx.onApplyFilter?.([l.account]),
      },
      l.amount < 0
        ? {
            text: 'Out',
            cls: 'hldg-direction-pill hldg-direction-out' + (directionFilter === 'out' ? ' hldg-direction-active' : ''),
            onClick: () => {
              directionFilter = directionFilter === 'out' ? 'all' : 'out';
              ctx.onUIStateChange?.({ directionFilter });
              renderTransfers(container, client, ctx);
            },
          }
        : {
            text: 'In',
            cls: 'hldg-direction-pill hldg-direction-in' + (directionFilter === 'in' ? ' hldg-direction-active' : ''),
            onClick: () => {
              directionFilter = directionFilter === 'in' ? 'all' : 'in';
              ctx.onUIStateChange?.({ directionFilter });
              renderTransfers(container, client, ctx);
            },
          },
      { text: formatAmount(Math.abs(l.amount), ctx.targetCurrency), sortValue: Math.abs(l.amount) },
    ]);
    createPaginatedTable(
      container,
      [
        { label: 'Date' },
        { label: 'Description' },
        { label: 'Account', align: 'center' },
        { label: 'Direction', align: 'center' },
        { label: 'Amount', align: 'right' },
      ],
      rows,
      ctx.settings.recentTxnCount || 50
    );
  }

  if (filtered.length === 0 && monthly.months.length === 0) {
    container.createEl('p', { text: 'No transfer data for this period', cls: 'hldg-empty' });
  }

  if (parentEl) parentEl.scrollTop = Math.min(savedScroll, parentEl.scrollHeight);
}
