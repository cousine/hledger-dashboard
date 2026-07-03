import { DashboardContext, BalanceEntry } from '../hledger/types';
import { HledgerClient } from '../hledger/client';
import { buildKpiRow, buildKpiCard } from '../ui/kpi';
import { createPaginatedTable, Column, Row } from '../ui/table';
import { createLineChart } from '../ui/chart';
import { applyCurrencyFilter, buildHledgerAccountArgs, shouldDropDepth } from '../filters';
import { formatAmount, PALETTE } from '../format';

function extractFlat(stdout: string): BalanceEntry[] {
  const raw: any[] = JSON.parse(stdout || '[]');
  const entries = Array.isArray(raw[0]) ? raw[0] : raw;
  const out: BalanceEntry[] = [];
  for (const e of entries) {
    if (!Array.isArray(e) || e.length < 4) continue;
    const name = e[0] as string;
    const indent = (e[2] as number) ?? 0;
    for (const amt of (e[3] as any[]) || []) {
      out.push({
        account: name,
        amount: amt.aquantity?.floatingPoint ?? 0,
        commodity: amt.acommodity ?? '',
        depth: indent,
      });
    }
  }
  return out;
}

function isLeaf(account: string, allAccounts: string[]): boolean {
  const prefix = account + ':';
  return !allAccounts.some(a => a !== account && a.startsWith(prefix));
}

let balanceSheetViewMode: 'summary' | 'detail' = 'detail';

function extractBalanceTimeSeries(stdout: string): { months: string[]; accounts: Record<string, number[]> } {
  const report = JSON.parse(stdout);
  const r = Array.isArray(report) ? report[0] : report;
  const months = r.prDates.map((dp: any) => {
    const d = dp[0]?.contents || '';
    return d.substring(0, 7);
  });
  const accounts: Record<string, number[]> = {};
  for (const row of r.prRows) {
    const name: string = row.prrName || '';
    const vals = new Array(months.length).fill(0);
    for (let i = 0; i < row.prrAmounts.length && i < months.length; i++) {
      const amtPairs = row.prrAmounts[i];
      if (Array.isArray(amtPairs)) {
        vals[i] = amtPairs.reduce((s: number, a: any) => s + (a.aquantity?.floatingPoint ?? 0), 0);
      }
    }
    accounts[name] = vals;
  }
  return { months, accounts };
}

export async function renderBalanceSheet(
  container: HTMLElement,
  client: HledgerClient,
  ctx: DashboardContext
): Promise<void> {
  balanceSheetViewMode = ctx.uiState?.balanceSheetMode ?? 'detail';
  container.empty();
  container.createEl('h2', { text: 'Balance Sheet' });

  const accountArgs = buildHledgerAccountArgs(ctx.filter, ['^assets:', '^liabilities:']);
  const depthArgs = shouldDropDepth(ctx.filter) ? [] : ['--depth', '5'];

  const baseArgs: string[] = [
    'balance',
    ...accountArgs,
    ...depthArgs,
    '-O', 'json',
    '--no-total',
    '--tree',
    '-p', ctx.period.hledgerPeriod,
    '-H',
  ];

  const [stdoutX, stdoutNative, stdoutPrices] = await Promise.all([
    client.exec(ctx.settings.hledgerPath, ['-X', ctx.targetCurrency, '-V', ...baseArgs], ctx.settings.journalFile),
    client.exec(ctx.settings.hledgerPath, baseArgs, ctx.settings.journalFile),
    client.exec(ctx.settings.hledgerPath, ['prices'], ctx.settings.journalFile).catch(() => ''),
  ]);

  const allX = extractFlat(stdoutX);
  const allNative = extractFlat(stdoutNative);

  const priceMap = new Map<string, number>();
  const escapedCurrency = ctx.targetCurrency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const priceRegex = new RegExp(`^P\\s+\\S+\\s+(\\S+)\\s+${escapedCurrency}\\s+([\\d,]+\\.?\\d*)`);
  for (const line of stdoutPrices.split('\n')) {
    const m = line.match(priceRegex);
    if (m) priceMap.set(m[1], parseFloat(m[2].replace(/,/g, '')));
  }

  if (allX.length === 0 && allNative.length === 0) {
    container.createEl('p', { text: 'No data', cls: 'hldg-empty' });
    return;
  }

  const filteredX = applyCurrencyFilter(allX, ctx.filter.currencies);
  const filteredNative = applyCurrencyFilter(allNative, ctx.filter.currencies);

  const topLevelX = filteredX.filter(e => e.depth === 0);

  const assetsTotal = topLevelX.find(e => e.account.startsWith('assets'));
  const liabilitiesTotal = topLevelX.find(e => e.account.startsWith('liabilities'));

  const netWorth = (assetsTotal?.amount ?? 0) + (liabilitiesTotal?.amount ?? 0);

  if (topLevelX.length > 0) {
    const kpiRow = buildKpiRow(container);
    buildKpiCard(kpiRow, 'Net Worth', formatAmount(netWorth, ctx.targetCurrency), 'hldg-value-positive');
    buildKpiCard(kpiRow, 'Assets', formatAmount(assetsTotal?.amount ?? 0, ctx.targetCurrency), 'hldg-value-positive');
    buildKpiCard(kpiRow, 'Liabilities', formatAmount(liabilitiesTotal?.amount ?? 0, ctx.targetCurrency), 'hldg-value-negative');
  }

  // Monthly time-series line chart (multi-month only)
  const periodStart = ctx.period.startDate;
  const periodEnd = ctx.period.endDate;
  const isMultiMonth = periodStart && periodEnd &&
    (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) > 40 * 24 * 60 * 60 * 1000;

  if (isMultiMonth) {
    try {
      const monthlyStdout = await client.exec(ctx.settings.hledgerPath, [
        'balance',
        ...accountArgs,
        '--depth', '2',
        '--monthly',
        '-H',
        '-X', ctx.targetCurrency,
        '-V',
        '-O', 'json',
        '-p', ctx.period.hledgerPeriod,
      ], ctx.settings.journalFile);
      const monthly = extractBalanceTimeSeries(monthlyStdout);

      if (monthly.months.length > 1) {
        const assetAccounts = Object.keys(monthly.accounts).filter(n => n.startsWith('assets:'));
        const liabilityAccounts = Object.keys(monthly.accounts).filter(n => n.startsWith('liabilities:'));

        const numPeriods = monthly.months.length;
        const assetsTotalTS = new Array(numPeriods).fill(0);
        const liabilitiesTotalTS = new Array(numPeriods).fill(0);

        for (const name of assetAccounts) {
          for (let i = 0; i < numPeriods; i++) {
            assetsTotalTS[i] += monthly.accounts[name][i];
          }
        }
        for (const name of liabilityAccounts) {
          for (let i = 0; i < numPeriods; i++) {
            liabilitiesTotalTS[i] += monthly.accounts[name][i];
          }
        }
        const netWorthTS = assetsTotalTS.map((a, i) => a + liabilitiesTotalTS[i]);

        const chartContainer = container.createDiv({ cls: 'hldg-chart-mount' });

        const datasets: {
          label: string;
          data: number[];
          borderColor: string;
          fill: boolean;
          borderDash?: number[];
        }[] = [
          { label: 'Assets', data: assetsTotalTS, borderColor: '#9ece6a', fill: false },
          { label: 'Liabilities', data: liabilitiesTotalTS, borderColor: '#f7768e', fill: false },
          { label: 'Net Worth', data: netWorthTS, borderColor: '#7aa2f7', fill: false },
        ];

        assetAccounts.forEach((name, i) => {
          datasets.push({
            label: name.replace('assets:', ''),
            data: monthly.accounts[name],
            borderColor: PALETTE[i % PALETTE.length],
            fill: false,
            borderDash: [4, 4],
          });
        });

        liabilityAccounts.forEach((name, i) => {
          datasets.push({
            label: name.replace('liabilities:', ''),
            data: monthly.accounts[name],
            borderColor: PALETTE[(assetAccounts.length + i) % PALETTE.length],
            fill: false,
            borderDash: [4, 4],
          });
        });

        createLineChart(chartContainer, monthly.months, datasets);
      }
    } catch (_e) {
      // monthly query failed silently
    }
  }

  // Table section with toggle
  const tableSection = container.createDiv();

  function renderTables() {
    tableSection.empty();

    // View toggle
    const toggleRow = tableSection.createDiv({ cls: 'hldg-view-toggle-row' });
    toggleRow.createSpan({ text: 'View:', cls: 'hldg-view-toggle-label' });
    const summaryBtn = toggleRow.createEl('button', {
      cls: `hldg-view-toggle-btn${balanceSheetViewMode === 'summary' ? ' hldg-view-toggle-active' : ''}`,
      text: 'Summary',
    });
    const detailBtn = toggleRow.createEl('button', {
      cls: `hldg-view-toggle-btn${balanceSheetViewMode === 'detail' ? ' hldg-view-toggle-active' : ''}`,
      text: 'Detail',
    });

    summaryBtn.addEventListener('click', () => {
      if (balanceSheetViewMode !== 'summary') {
        balanceSheetViewMode = 'summary';
        ctx.onUIStateChange?.({ balanceSheetMode: 'summary' });
        renderTables();
      }
    });
    detailBtn.addEventListener('click', () => {
      if (balanceSheetViewMode !== 'detail') {
        balanceSheetViewMode = 'detail';
        ctx.onUIStateChange?.({ balanceSheetMode: 'detail' });
        renderTables();
      }
    });

    // Hybrid: native for currency entries, -X converted for stock accounts
    const knownCurrencies = new Set(['EGP', 'USD', '$', 'EUR', 'GBP']);
    const stockAccounts = new Set<string>();
    for (const e of filteredNative) {
      if (e.account.startsWith('assets:') && e.account !== 'assets' && !knownCurrencies.has(e.commodity)) {
        stockAccounts.add(e.account);
      }
    }
    const xByAccount = new Map<string, BalanceEntry>();
    for (const e of filteredX) {
      if (stockAccounts.has(e.account)) xByAccount.set(e.account, e);
    }

    const merged: BalanceEntry[] = [];
    const seen = new Set<string>();
    for (const e of filteredNative) {
      if (stockAccounts.has(e.account)) {
        if (balanceSheetViewMode === 'detail' && !knownCurrencies.has(e.commodity)) {
          const price = priceMap.get(e.commodity) || 0;
          merged.push({
            account: `${e.account}:${e.commodity}`,
            amount: e.amount * price,
            commodity: ctx.targetCurrency,
            depth: e.depth + 1,
          });
        } else if (!seen.has(e.account)) {
          seen.add(e.account);
          const xEntry = xByAccount.get(e.account);
          if (xEntry) merged.push(xEntry);
        }
      } else {
        merged.push(e);
      }
    }

    const uniqueAccounts = [...new Set(merged.map(e => e.account))];
    let tableEntries = merged.filter(e => e.account.startsWith('assets:') || e.account.startsWith('liabilities:'));
    if (balanceSheetViewMode === 'summary') {
      tableEntries = tableEntries.filter(e => e.depth === 1);
    } else {
      tableEntries = tableEntries.filter(e => isLeaf(e.account, uniqueAccounts));
    }

    const assetRows: Row[] = tableEntries
      .filter(e => e.account.startsWith('assets:'))
      .map(e => [e.account.replace('assets:', ''), { text: formatAmount(e.amount, e.commodity), sortValue: e.amount }]);

    const liabilityRows: Row[] = tableEntries
      .filter(e => e.account.startsWith('liabilities:'))
      .map(e => [e.account.replace('liabilities:', ''), { text: formatAmount(e.amount, e.commodity), sortValue: e.amount }]);

    if (assetRows.length > 0 && liabilityRows.length > 0) {
      const cols = tableSection.createDiv({ cls: 'hldg-columns' });
      const left = cols.createDiv();
      left.createEl('h3', { text: 'Assets' });
      createPaginatedTable(left, [{ label: 'Account' }, { label: 'Balance', align: 'right' }], assetRows, ctx.settings.recentTxnCount || 50);
      const right = cols.createDiv();
      right.createEl('h3', { text: 'Liabilities' });
      createPaginatedTable(right, [{ label: 'Account' }, { label: 'Balance', align: 'right' }], liabilityRows, ctx.settings.recentTxnCount || 50);
    } else {
      if (assetRows.length > 0) {
        tableSection.createEl('h3', { text: 'Assets' });
        createPaginatedTable(tableSection, [{ label: 'Account' }, { label: 'Balance', align: 'right' }], assetRows, ctx.settings.recentTxnCount || 50);
      }
      if (liabilityRows.length > 0) {
        tableSection.createEl('h3', { text: 'Liabilities' });
        createPaginatedTable(tableSection, [{ label: 'Account' }, { label: 'Balance', align: 'right' }], liabilityRows, ctx.settings.recentTxnCount || 50);
      }
    }
  }

  renderTables();
}
