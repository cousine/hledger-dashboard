import { applyCurrencyFilter, buildHledgerAccountArgs, shouldDropDepth } from '../filters';
import { formatAmount, PALETTE } from '../format';
import type { HledgerClient } from '../hledger/client';
import { extractFlat, extractMonthlyTrend } from '../hledger/parse';
import type { DashboardContext } from '../hledger/types';
import { createDoughnutChart, createLineChart } from '../ui/chart';
import { buildKpiCard, buildKpiRow } from '../ui/kpi';
import { createPaginatedTable, type Row } from '../ui/table';

let expenseViewMode: 'groups' | 'atomic' = 'atomic';

export async function renderActivity(
  container: HTMLElement,
  client: HledgerClient,
  ctx: DashboardContext,
): Promise<void> {
  expenseViewMode = ctx.uiState?.expenseMode ?? 'atomic';
  container.empty();
  container.createEl('h2', { text: 'Activity' });

  const accountArgs = buildHledgerAccountArgs(ctx.filter, ['^income:', '^expenses:']);
  const depthArgs = shouldDropDepth(ctx.filter) ? [] : ['--depth', '3'];

  const baseArgs: string[] = [
    'balance',
    ...accountArgs,
    ...depthArgs,
    '-O',
    'json',
    '--no-total',
    '--tree',
    '-p',
    ctx.period.hledgerPeriod,
  ];

  const [stdoutX, stdoutNative] = await Promise.all([
    client.exec(
      ctx.settings.hledgerPath,
      ['-X', ctx.targetCurrency, ...baseArgs],
      ctx.settings.journalFile,
    ),
    client.exec(ctx.settings.hledgerPath, baseArgs, ctx.settings.journalFile),
  ]);

  const allX = extractFlat(stdoutX);
  const allNative = extractFlat(stdoutNative);

  if (allX.length === 0 && allNative.length === 0) {
    container.createEl('p', { text: 'No data', cls: 'hldg-empty' });
    return;
  }

  const filteredX = applyCurrencyFilter(allX, ctx.filter.currencies);
  const filteredNative = applyCurrencyFilter(allNative, ctx.filter.currencies);

  const incomeEntry = filteredX.find((e) => e.depth === 0 && e.account.startsWith('income'));
  const expenseEntry = filteredX.find((e) => e.depth === 0 && e.account.startsWith('expenses'));

  const incomeTotal = -(incomeEntry?.amount ?? 0);
  const expenseTotal = expenseEntry?.amount ?? 0;
  const netTotal = incomeTotal - expenseTotal;

  const kpiRow = buildKpiRow(container);
  buildKpiCard(
    kpiRow,
    'Income',
    formatAmount(incomeTotal, ctx.targetCurrency),
    'hldg-value-positive',
  );
  buildKpiCard(
    kpiRow,
    'Expenses',
    formatAmount(expenseTotal, ctx.targetCurrency),
    'hldg-value-negative',
  );
  buildKpiCard(
    kpiRow,
    'Net',
    formatAmount(netTotal, ctx.targetCurrency),
    netTotal >= 0 ? 'hldg-value-positive' : 'hldg-value-negative',
  );

  container.createEl('br');

  const expenseChildrenX = filteredX.filter(
    (e) => e.depth === 1 && e.account.startsWith('expenses:'),
  );
  const expenseAtomicX = filteredX.filter(
    (e) => e.depth === 2 && e.account.startsWith('expenses:'),
  );
  const expenseChildrenNative = filteredNative.filter(
    (e) => e.depth === 1 && e.account.startsWith('expenses:'),
  );
  const expenseAtomicNative = filteredNative.filter(
    (e) => e.depth === 2 && e.account.startsWith('expenses:'),
  );
  const incomeChildrenNative = filteredNative.filter(
    (e) => e.depth === 1 && e.account.startsWith('income:'),
  );

  // monthly income/expense trend (line chart)
  const periodStart = ctx.period.startDate;
  const periodEnd = ctx.period.endDate;
  const isMultiMonth =
    periodStart &&
    periodEnd &&
    new Date(periodEnd).getTime() - new Date(periodStart).getTime() > 40 * 24 * 60 * 60 * 1000;
  if (
    isMultiMonth &&
    (incomeChildrenNative.length > 0 ||
      filteredX.some((e) => e.depth === 0 && e.account.startsWith('income')))
  ) {
    try {
      const monthlyStdout = await client.exec(
        ctx.settings.hledgerPath,
        [
          'balance',
          '^income:',
          '^expenses:',
          '--depth',
          '1',
          '-p',
          `${periodStart}..${periodEnd}`,
          '--monthly',
          '-X',
          ctx.targetCurrency,
          '-O',
          'json',
        ],
        ctx.settings.journalFile,
      );
      const monthly = extractMonthlyTrend(monthlyStdout);
      if (monthly.months.length > 1) {
        container.createEl('h3', { text: 'Monthly trend' });
        const chartRow = container.createDiv({ cls: 'hldg-chart-mount' });
        createLineChart(chartRow, monthly.months, [
          {
            label: 'Income',
            data: monthly.income,
            borderColor: '#9ece6a',
            backgroundColor: '#9ece6a33',
            fill: true,
          },
          {
            label: 'Expenses',
            data: monthly.expenses,
            borderColor: '#f7768e',
            backgroundColor: '#f7768e33',
            fill: true,
          },
        ]);
      }
    } catch {
      // monthly query failed silently
    }
  }

  // Expense breakdown section with toggle
  const expenseSection = container.createDiv();

  function renderExpenseSection() {
    expenseSection.empty();

    const showX = expenseViewMode === 'atomic' ? expenseAtomicX : expenseChildrenX;
    const showNative = expenseViewMode === 'atomic' ? expenseAtomicNative : expenseChildrenNative;
    const catLabel = expenseViewMode === 'atomic' ? 'All Accounts' : 'Account Groups';

    if (showX.length === 0 && showNative.length === 0) return;

    expenseSection.createEl('h3', { text: 'Expense breakdown' });

    // View toggle
    const toggleRow = expenseSection.createDiv({ cls: 'hldg-view-toggle-row' });
    toggleRow.createSpan({ text: 'View:', cls: 'hldg-view-toggle-label' });
    const groupsBtn = toggleRow.createEl('button', {
      cls: `hldg-view-toggle-btn${expenseViewMode === 'groups' ? ' hldg-view-toggle-active' : ''}`,
      text: 'Groups',
    });
    const atomicBtn = toggleRow.createEl('button', {
      cls: `hldg-view-toggle-btn${expenseViewMode === 'atomic' ? ' hldg-view-toggle-active' : ''}`,
      text: 'Atomic',
    });

    groupsBtn.addEventListener('click', () => {
      if (expenseViewMode !== 'groups') {
        expenseViewMode = 'groups';
        ctx.onUIStateChange?.({ expenseMode: 'groups' });
        renderExpenseSection();
      }
    });
    atomicBtn.addEventListener('click', () => {
      if (expenseViewMode !== 'atomic') {
        expenseViewMode = 'atomic';
        ctx.onUIStateChange?.({ expenseMode: 'atomic' });
        renderExpenseSection();
      }
    });

    const chartRow = expenseSection.createDiv({ cls: 'hldg-chart-sidebar' });
    const chartCol = chartRow.createDiv({ cls: 'hldg-chart-mount' });
    const tableCol = chartRow.createDiv();

    if (showX.length > 0) {
      createDoughnutChart(
        chartCol,
        showX.map((e) => e.account.replace('expenses:', '')),
        showX.map((e) => Math.abs(e.amount)),
        showX.map((_, i) => PALETTE[i % PALETTE.length]),
      );
    }

    if (showNative.length > 0) {
      const rows: Row[] = showNative.map((e) => {
        const name = e.account.replace('expenses:', '');
        const fullAccount = e.account;
        const pct = expenseTotal > 0 ? `${((e.amount / expenseTotal) * 100).toFixed(1)}%` : '';
        const pctVal = expenseTotal > 0 ? (e.amount / expenseTotal) * 100 : 0;
        return [
          {
            text: name,
            cls: 'hldg-clickable-account',
            onClick: () => ctx.onNavigate?.('transactions', [fullAccount]),
          },
          { text: formatAmount(e.amount, e.commodity), cls: '', sortValue: e.amount },
          { text: pct, sortValue: pctVal },
        ];
      });
      rows.sort((a, b) => {
        const av = (a[2] as { sortValue?: number })?.sortValue ?? 0;
        const bv = (b[2] as { sortValue?: number })?.sortValue ?? 0;
        return bv - av;
      });
      createPaginatedTable(
        tableCol,
        [
          { label: catLabel },
          { label: 'Amount', align: 'right', width: '160px' },
          { label: '%', align: 'right', width: '60px' },
        ],
        rows,
        ctx.settings.recentTxnCount || 50,
      );
    }
  }

  renderExpenseSection();

  if (incomeChildrenNative.length > 0) {
    container.createEl('h3', { text: 'Income breakdown' });
    const rows: Row[] = incomeChildrenNative.map((e) => [
      e.account.replace('income:', ''),
      { text: formatAmount(-e.amount, e.commodity), sortValue: -e.amount },
    ]);
    createPaginatedTable(
      container,
      [{ label: 'Source' }, { label: 'Amount', align: 'right' }],
      rows,
      ctx.settings.recentTxnCount || 50,
    );
  }
}
