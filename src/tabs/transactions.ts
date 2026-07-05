import { matchPattern } from '../filters';
import { CONTRAST_PALETTE, formatAmount } from '../format';
import type { HledgerClient } from '../hledger/client';
import { extractRegister, getTxnType } from '../hledger/parse';
import type { DashboardContext, RegisterEntry } from '../hledger/types';
import { createDoughnutChart } from '../ui/chart';
import { buildKpiCard, buildKpiRow } from '../ui/kpi';
import { buildTable, type Row } from '../ui/table';

function groupBreakdown(
  entries: RegisterEntry[],
  prefix: string,
  depth: number,
): { labels: string[]; data: number[] } {
  const groups = new Map<string, number>();
  for (const e of entries) {
    if (!e.account.startsWith(prefix)) continue;
    const parts = e.account.split(':');
    const key = parts.length > 1 ? parts.slice(0, depth).join(':') : parts[0];
    groups.set(key, (groups.get(key) || 0) + Math.abs(e.amount));
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1]);
  return { labels: sorted.map(([k]) => k), data: sorted.map(([, v]) => v) };
}

let txnTypeFilter: 'all' | 'credit' | 'debit' = 'all';
let breakdownDepth: 2 | 3 = 2;

export async function renderTransactions(
  container: HTMLElement,
  client: HledgerClient,
  ctx: DashboardContext,
  page?: number,
): Promise<void> {
  txnTypeFilter = ctx.uiState?.txnTypeFilter ?? 'all';
  breakdownDepth = ctx.uiState?.breakdownDepth ?? 2;
  container.empty();

  container.createEl('h2', { text: 'Transactions' });

  const controlsRow = container.createDiv({ cls: 'hldg-txn-controls' });
  const searchInput = controlsRow.createEl('input', {
    cls: 'hldg-txn-search',
    attr: { type: 'text', placeholder: 'Search description…' },
  });

  const contentDiv = container.createDiv({ cls: 'hldg-txn-content' });

  const stdout = await client.exec(
    ctx.settings.hledgerPath,
    [
      'register',
      '-O',
      'json',
      '-X',
      ctx.targetCurrency,
      '-p',
      ctx.period.hledgerPeriod,
      '--depth',
      '3',
    ],
    ctx.settings.journalFile,
  );

  const all = extractRegister(stdout);

  // --- state ---
  let currentPage = page ?? 0;
  let searchQuery = '';
  let sortCol = 0;
  let sortAsc = false;

  function getSortKey(t: RegisterEntry, col: number): string | number {
    switch (col) {
      case 0:
        return t.date;
      case 1:
        return t.description;
      case 2:
        return t.account;
      case 3:
        return getTxnType(t.account, t.amount);
      case 4:
        return t.amount;
      default:
        return '';
    }
  }

  function renderContent() {
    const scrollParent = container.parentElement;
    const savedScroll = scrollParent?.scrollTop ?? 0;
    contentDiv.empty();

    if (all.length === 0) {
      contentDiv.createEl('p', { text: 'No transactions', cls: 'hldg-empty' });
      return;
    }

    let filtered = [...all];

    // account pattern filters from filter bar
    if (ctx.filter.accountPatterns.length > 0) {
      filtered = filtered.filter((t) =>
        ctx.filter.accountPatterns.some((p) => matchPattern(t.account, p)),
      );
    }

    // currency filter from filter bar
    if (ctx.filter.currencies.length > 0) {
      filtered = filtered.filter((t) => ctx.filter.currencies.includes(t.commodity));
    }

    // search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((t) => t.description.toLowerCase().includes(q));
    }

    // type filter (local)
    if (txnTypeFilter !== 'all') {
      filtered = filtered.filter(
        (t) => getTxnType(t.account, t.amount).toLowerCase() === txnTypeFilter,
      );
    }

    // KPIs
    const totalInflow = filtered
      .filter((t) => getTxnType(t.account, t.amount) === 'Credit')
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalOutflow = filtered
      .filter((t) => getTxnType(t.account, t.amount) === 'Debit')
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const net = totalInflow - totalOutflow;

    const kpiRow = buildKpiRow(contentDiv);
    buildKpiCard(
      kpiRow,
      'Inflow',
      formatAmount(totalInflow, ctx.targetCurrency),
      'hldg-value-positive',
    );
    buildKpiCard(
      kpiRow,
      'Outflow',
      formatAmount(totalOutflow, ctx.targetCurrency),
      'hldg-value-negative',
    );
    buildKpiCard(
      kpiRow,
      'Net',
      formatAmount(net, ctx.targetCurrency),
      net >= 0 ? 'hldg-value-positive' : 'hldg-value-negative',
    );

    // Breakdown grouping toggle + doughnut charts
    const groupingRow = contentDiv.createDiv({ cls: 'hldg-view-toggle-row' });
    groupingRow.createSpan({ text: 'Breakdown:', cls: 'hldg-view-toggle-label' });
    const tier2Btn = groupingRow.createEl('button', {
      cls: `hldg-view-toggle-btn${breakdownDepth === 2 ? ' hldg-view-toggle-active' : ''}`,
      text: 'Tier 2',
    });
    tier2Btn.addEventListener('click', () => {
      if (breakdownDepth !== 2) {
        breakdownDepth = 2;
        ctx.onUIStateChange?.({ breakdownDepth: 2 });
        renderContent();
      }
    });
    const tier3Btn = groupingRow.createEl('button', {
      cls: `hldg-view-toggle-btn${breakdownDepth === 3 ? ' hldg-view-toggle-active' : ''}`,
      text: 'Tier 3',
    });
    tier3Btn.addEventListener('click', () => {
      if (breakdownDepth !== 3) {
        breakdownDepth = 3;
        ctx.onUIStateChange?.({ breakdownDepth: 3 });
        renderContent();
      }
    });

    const expBreakdown = groupBreakdown(filtered, 'expenses:', breakdownDepth);
    const incBreakdown = groupBreakdown(filtered, 'income:', breakdownDepth);
    const liabBreakdown = groupBreakdown(filtered, 'liabilities:', breakdownDepth);

    if (
      expBreakdown.labels.length > 0 ||
      incBreakdown.labels.length > 0 ||
      liabBreakdown.labels.length > 0
    ) {
      const chartRow = contentDiv.createDiv({ cls: 'hldg-chart-grid' });

      if (expBreakdown.labels.length > 0) {
        const chartCol = chartRow.createDiv({ cls: 'hldg-chart-mount' });
        chartCol.createEl('h4', { text: 'Expenses' });
        createDoughnutChart(
          chartCol,
          expBreakdown.labels,
          expBreakdown.data,
          expBreakdown.labels.map((_, i) => CONTRAST_PALETTE[i % CONTRAST_PALETTE.length]),
        );
      }

      if (incBreakdown.labels.length > 0) {
        const chartCol = chartRow.createDiv({ cls: 'hldg-chart-mount' });
        chartCol.createEl('h4', { text: 'Income' });
        createDoughnutChart(
          chartCol,
          incBreakdown.labels,
          incBreakdown.data,
          incBreakdown.labels.map((_, i) => CONTRAST_PALETTE[i % CONTRAST_PALETTE.length]),
        );
      }

      if (liabBreakdown.labels.length > 0) {
        const chartCol = chartRow.createDiv({ cls: 'hldg-chart-mount' });
        chartCol.createEl('h4', { text: 'Liabilities' });
        createDoughnutChart(
          chartCol,
          liabBreakdown.labels,
          liabBreakdown.data,
          liabBreakdown.labels.map((_, i) => CONTRAST_PALETTE[i % CONTRAST_PALETTE.length]),
        );
      }
    }

    // Type toggle bar
    const toggleRow = contentDiv.createDiv({ cls: 'hldg-view-toggle-row' });
    toggleRow.createSpan({ text: 'Type:', cls: 'hldg-view-toggle-label' });
    const allBtn = toggleRow.createEl('button', {
      cls: `hldg-view-toggle-btn${txnTypeFilter === 'all' ? ' hldg-view-toggle-active' : ''}`,
      text: 'All',
    });
    allBtn.addEventListener('click', () => {
      if (txnTypeFilter !== 'all') {
        txnTypeFilter = 'all';
        ctx.onUIStateChange?.({ txnTypeFilter: 'all' });
        renderContent();
      }
    });
    const creditBtn = toggleRow.createEl('button', {
      cls: `hldg-view-toggle-btn${txnTypeFilter === 'credit' ? ' hldg-view-toggle-active' : ''}`,
      text: 'Credit',
    });
    creditBtn.addEventListener('click', () => {
      if (txnTypeFilter !== 'credit') {
        txnTypeFilter = 'credit';
        ctx.onUIStateChange?.({ txnTypeFilter: 'credit' });
        renderContent();
      }
    });
    const debitBtn = toggleRow.createEl('button', {
      cls: `hldg-view-toggle-btn${txnTypeFilter === 'debit' ? ' hldg-view-toggle-active' : ''}`,
      text: 'Debit',
    });
    debitBtn.addEventListener('click', () => {
      if (txnTypeFilter !== 'debit') {
        txnTypeFilter = 'debit';
        ctx.onUIStateChange?.({ txnTypeFilter: 'debit' });
        renderContent();
      }
    });

    // sort full dataset
    filtered.sort((a, b) => {
      const av = getSortKey(a, sortCol);
      const bv = getSortKey(b, sortCol);
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
      }
      return sortAsc ? cmp : -cmp;
    });

    const pageSize = ctx.settings.recentTxnCount || 50;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (currentPage >= totalPages) currentPage = totalPages - 1;

    const startIdx = currentPage * pageSize;
    const pageItems = filtered.slice(startIdx, startIdx + pageSize);

    const rows: Row[] = pageItems.map((t) => [
      t.date,
      t.description,
      {
        text: t.account,
        cls: 'hldg-clickable-account',
        onClick: () => ctx.onApplyFilter?.([t.account]),
      },
      {
        text: getTxnType(t.account, t.amount),
        cls: `hldg-txn-type hldg-txn-type-${getTxnType(t.account, t.amount).toLowerCase()}${txnTypeFilter !== 'all' && getTxnType(t.account, t.amount).toLowerCase() === txnTypeFilter ? ' hldg-txn-type-active' : ''}`,
        onClick: () => {
          const type = getTxnType(t.account, t.amount).toLowerCase() as 'credit' | 'debit';
          txnTypeFilter = txnTypeFilter === type ? 'all' : type;
          renderContent();
        },
      },
      { text: formatAmount(t.amount, t.commodity), sortValue: t.amount },
    ]);

    buildTable(
      contentDiv,
      [
        { label: 'Date' },
        { label: 'Description' },
        { label: 'Account', align: 'center' },
        { label: 'Type' },
        { label: 'Amount', align: 'right' },
      ],
      rows,
      undefined,
      { col: sortCol, asc: sortAsc },
      (col: number) => {
        if (sortCol === col) {
          sortAsc = !sortAsc;
        } else {
          sortCol = col;
          sortAsc = true;
        }
        currentPage = 0;
        renderContent();
      },
    );

    if (totalPages > 1) {
      const nav = contentDiv.createDiv({ cls: 'hldg-pagination' });

      const firstBtn = nav.createEl('button', { cls: 'hldg-page-btn', text: '<< first' });
      firstBtn.disabled = currentPage === 0;
      firstBtn.addEventListener('click', () => {
        currentPage = 0;
        renderContent();
      });

      const prevBtn = nav.createEl('button', { cls: 'hldg-page-btn', text: '‹ prev' });
      prevBtn.disabled = currentPage === 0;
      prevBtn.addEventListener('click', () => {
        if (currentPage > 0) {
          currentPage--;
          renderContent();
        }
      });

      nav.createSpan({
        cls: 'hldg-page-info',
        text: `Page ${currentPage + 1} of ${totalPages} (${filtered.length} transactions)`,
      });

      const nextBtn = nav.createEl('button', { cls: 'hldg-page-btn', text: 'Next ›' });
      nextBtn.disabled = currentPage >= totalPages - 1;
      nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages - 1) {
          currentPage++;
          renderContent();
        }
      });

      const lastBtn = nav.createEl('button', { cls: 'hldg-page-btn', text: 'Last >>' });
      lastBtn.disabled = currentPage >= totalPages - 1;
      lastBtn.addEventListener('click', () => {
        currentPage = totalPages - 1;
        renderContent();
      });
    }

    if (scrollParent) scrollParent.scrollTop = Math.min(savedScroll, scrollParent.scrollHeight);
  }

  // --- wire events ---
  searchInput.value = '';
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    currentPage = 0;
    renderContent();
  });

  // --- initial render ---
  renderContent();
}
