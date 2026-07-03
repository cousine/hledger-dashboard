import { DashboardContext } from '../hledger/types';
import { HledgerClient } from '../hledger/client';
import { buildKpiRow, buildKpiCard } from '../ui/kpi';
import { createPaginatedTable, Row } from '../ui/table';
import { createBarChart, createLineChart } from '../ui/chart';
import { formatAmount, PALETTE } from '../format';
import { buildHledgerAccountArgs } from '../filters';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else current += ch;
  }
  result.push(current);
  return result;
}

function parseAmount(str: string): { quantity: number; commodity: string } {
  const t = str.trim();
  if (!t || t === '0' || t === '"0"') return { quantity: 0, commodity: '' };
  const dm = t.match(/^\$(-?[\d,]+\.?\d*)/);
  if (dm) return { quantity: parseFloat(dm[1].replace(/,/g, '')), commodity: '$' };
  const em = t.match(/^([A-Z]+)\s+(-?[\d,]+\.?\d*)/);
  if (em) return { quantity: parseFloat(em[2].replace(/,/g, '')), commodity: em[1] };
  const sm = t.match(/(-?[\d,]+\.?\d*)\s+(\w+)/);
  if (sm) return { quantity: parseFloat(sm[1].replace(/,/g, '')), commodity: sm[2] };
  const n = parseFloat(t.replace(/,/g, ''));
  if (!isNaN(n)) return { quantity: n, commodity: '' };
  return { quantity: 0, commodity: '' };
}

function extractMonthlyData(stdout: string): { months: string[]; income: number[]; expenses: number[]; liabilities: number[] } {
  const report = JSON.parse(stdout);
  const r = Array.isArray(report) ? report[0] : report;
  if (!r || !r.prDates || !r.prRows) return { months: [], income: [], expenses: [], liabilities: [] };
  const months = r.prDates.map((dp: any) => {
    const d = dp[0]?.contents || '';
    return d.substring(0, 7);
  });
  const income = new Array(months.length).fill(0);
  const expenses = new Array(months.length).fill(0);
  const liabilities = new Array(months.length).fill(0);
  for (const row of r.prRows) {
    const name: string = row.prrName || '';
    for (let i = 0; i < row.prrAmounts.length && i < months.length; i++) {
      const amtPairs = row.prrAmounts[i];
      let val = 0;
      if (Array.isArray(amtPairs)) {
        val = amtPairs.reduce((s: number, a: any) => s + (a.aquantity?.floatingPoint ?? 0), 0);
      }
      if (name === 'income' || name.startsWith('income:')) income[i] -= val;
      else if (name === 'expenses' || name.startsWith('expenses:')) expenses[i] += val;
      else if (name === 'liabilities' || name.startsWith('liabilities:')) liabilities[i] += val;
    }
  }
  return { months, income, expenses, liabilities };
}

function extractMonthlyAssetsByGroup(stdout: string): { months: string[]; groups: Record<string, number[]> } {
  const report = JSON.parse(stdout);
  const r = Array.isArray(report) ? report[0] : report;
  if (!r || !r.prDates || !r.prRows) return { months: [], groups: {} };
  const months = r.prDates.map((dp: any) => {
    const d = dp[0]?.contents || '';
    return d.substring(0, 7);
  });
  const groups: Record<string, number[]> = {};
  for (const row of r.prRows) {
    const name: string = row.prrName || '';
    if (name.startsWith('assets:')) {
      const groupName = name.replace('assets:', '');
      const vals = new Array(months.length).fill(0);
      for (let i = 0; i < row.prrAmounts.length && i < months.length; i++) {
        const amtPairs = row.prrAmounts[i];
        if (Array.isArray(amtPairs)) {
          vals[i] = amtPairs.reduce((s: number, a: any) => s + (a.aquantity?.floatingPoint ?? 0), 0);
        }
      }
      groups[groupName] = vals;
    }
  }
  return { months, groups };
}

export async function renderBudget(
  container: HTMLElement,
  client: HledgerClient,
  ctx: DashboardContext
): Promise<void> {
  container.empty();
  container.createEl('h2', { text: 'Budget vs Actual' });

  const expenseLiabAccountArgs = buildHledgerAccountArgs(ctx.filter, ['expenses:', 'liabilities:']);

  const stdout = await client.exec(ctx.settings.hledgerPath, [
    'balance', ...expenseLiabAccountArgs, '--budget',
    '-X', ctx.targetCurrency,
    '-p', ctx.period.hledgerPeriod,
    '-O', 'csv', '--no-total',
  ], ctx.settings.journalFile);

  const lines = stdout.trim().split('\n');
  if (lines.length < 2) {
    container.createEl('p', { text: 'No budget data for this period', cls: 'hldg-empty' });
    return;
  }

  const headerCols = parseCsvLine(lines[0]);
  const budgetColIdx = headerCols.findIndex(c => c.replace(/"/g, '').trim() === 'budget');
  if (budgetColIdx < 0) {
    container.createEl('p', { text: 'No budget column found', cls: 'hldg-empty' });
    return;
  }

  const budgetData: { account: string; actual: number; budget: number; commodity: string }[] = [];

  const accountNames: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 3) continue;
    const account = cols[0].trim();
    if ((account.startsWith('expenses:') && account !== 'expenses') || (account.startsWith('liabilities:') && account !== 'liabilities')) {
      accountNames.push(account);
    }
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 3) continue;
    const account = cols[0].trim();
    const actualVal = parseAmount(cols[budgetColIdx === 1 ? 2 : 1] || '');
    const budgetVal = parseAmount(cols[budgetColIdx] || '');
    if (budgetVal.quantity === 0 && actualVal.quantity === 0) continue;
    if ((!account.startsWith('expenses:') && !account.startsWith('liabilities:')) || account === 'expenses' || account === 'liabilities') continue;
    if (accountNames.some(a => a !== account && a.startsWith(account + ':'))) continue;
    const isLiability = account.startsWith('liabilities:');
    budgetData.push({
      account: account.replace(/^(?:expenses|liabilities):/, ''),
      actual: isLiability ? Math.abs(actualVal.quantity) : actualVal.quantity,
      budget: isLiability ? Math.abs(budgetVal.quantity) : budgetVal.quantity,
      commodity: actualVal.commodity || ctx.targetCurrency,
    });
  }

  const todayStr = new Date().toISOString().substring(0, 10);
  try {
    const futureStdout = await client.exec(ctx.settings.hledgerPath, [
      'register', ...expenseLiabAccountArgs,
      '-p', `${todayStr}..`,
      '-X', ctx.targetCurrency,
      '-O', 'csv',
    ], ctx.settings.journalFile);

    const futureLines = futureStdout.trim().split('\n');
    if (futureLines.length > 1) {
      const futureActuals = new Map<string, number>();
      for (let i = 1; i < futureLines.length; i++) {
        const cols = parseCsvLine(futureLines[i]);
        if (cols.length < 6) continue;
        const account = cols[4].trim();
        if ((!account.startsWith('expenses:') && !account.startsWith('liabilities:')) || account === 'expenses' || account === 'liabilities') continue;
        const amt = parseAmount(cols[5] || '');
        if (amt.quantity <= 0) continue;
        futureActuals.set(account, (futureActuals.get(account) || 0) + amt.quantity);
      }
      const existingAccounts = new Set(budgetData.map(d => d.account));
      for (const [account, total] of futureActuals) {
        const stripped = account.replace(/^(?:expenses|liabilities):/, '');
        if (existingAccounts.has(stripped)) continue;
        budgetData.push({
          account: stripped,
          actual: 0,
          budget: total,
          commodity: ctx.targetCurrency,
        });
      }
    }
  } catch (_e) {
    // future query failed silently
  }

  if (budgetData.length === 0) {
    container.createEl('p', { text: 'No budget data', cls: 'hldg-empty' });
    return;
  }

  const totalBudget = budgetData.reduce((s, d) => s + d.budget, 0);
  const totalActual = budgetData.reduce((s, d) => s + d.actual, 0);

  const kpiRow = buildKpiRow(container);
  buildKpiCard(kpiRow, 'Budget', formatAmount(totalBudget, ctx.targetCurrency), '');
  buildKpiCard(kpiRow, 'Actual', formatAmount(totalActual, ctx.targetCurrency), '');
  buildKpiCard(kpiRow, 'Remaining', formatAmount(totalBudget - totalActual, ctx.targetCurrency),
    totalBudget - totalActual >= 0 ? 'hldg-value-positive' : 'hldg-value-negative');

  if (budgetData.length > 0) {
    const chartContainer = container.createDiv({ cls: 'hldg-chart-mount' });
    createBarChart(chartContainer, budgetData.map(d => d.account), [
      {
        label: 'Budget',
        data: budgetData.map(d => d.budget),
        backgroundColor: '#7aa2f7',
      },
      {
        label: 'Actual',
        data: budgetData.map(d => d.actual),
        backgroundColor: '#9ece6a',
      },
    ]);
  }

  container.createEl('br');

  const rows: Row[] = budgetData.map(d => {
    const remaining = d.budget - d.actual;
    const pct = d.budget > 0 ? ((d.actual / d.budget) * 100).toFixed(0) + '%' : '';
    const pctVal = d.budget > 0 ? (d.actual / d.budget) * 100 : 0;
    return [
      d.account,
      { text: formatAmount(d.budget, d.commodity), sortValue: d.budget },
      { text: formatAmount(d.actual, d.commodity), sortValue: d.actual },
      { text: formatAmount(remaining, d.commodity), sortValue: remaining },
      { text: pct, sortValue: pctVal },
    ];
  });

  createPaginatedTable(
    container,
    [
      { label: 'Category' },
      { label: 'Budget', align: 'right' },
      { label: 'Actual', align: 'right' },
      { label: 'Remaining', align: 'right' },
      { label: '% Used', align: 'right' },
    ],
    rows,
    ctx.settings.recentTxnCount || 50
  );

  // Forecast
  const yearStr = ctx.period.startDate.substring(0, 4);
  const today = new Date();
  const currentMonth = today.getMonth();
  const chartYear = parseInt(yearStr);
  const chartCurrentMonth = chartYear < today.getFullYear() ? 11 :
                            chartYear > today.getFullYear() ? -1 :
                            currentMonth;

  try {
    const fullYearPeriod = `${yearStr}-01-01..${yearStr}-12-31`;
    const forecastAllAccountArgs = buildHledgerAccountArgs(ctx.filter, ['^income:', '^expenses:', '^liabilities:']);
    const forecastAssetAccountArgs = buildHledgerAccountArgs(ctx.filter, ['assets']);
    const forecastBudgetAccountArgs = buildHledgerAccountArgs(ctx.filter, ['income:', 'expenses:', 'liabilities:']);
    const [monthlyStdout, budgetStdout, assetsStdout] = await Promise.all([
      client.exec(ctx.settings.hledgerPath, [
        'balance', ...forecastAllAccountArgs,
        '--depth', '1',
        '--monthly',
        '-X', ctx.targetCurrency,
        '-p', fullYearPeriod,
        '-O', 'json',
      ], ctx.settings.journalFile),
      client.exec(ctx.settings.hledgerPath, [
        'balance', ...forecastBudgetAccountArgs, '--budget',
        '-X', ctx.targetCurrency,
        '-p', fullYearPeriod,
        '-O', 'csv', '--no-total',
      ], ctx.settings.journalFile),
      client.exec(ctx.settings.hledgerPath, [
        'balance', ...forecastAssetAccountArgs,
        '--monthly', '-H',
        '-X', ctx.targetCurrency,
        '--depth', '2',
        '-p', fullYearPeriod,
        '-O', 'json',
      ], ctx.settings.journalFile),
    ]);

    const monthly = extractMonthlyData(monthlyStdout);
    if (monthly.months.length < 2) return;

    const monthlyAssets = extractMonthlyAssetsByGroup(assetsStdout);
    const groupNames = Object.keys(monthlyAssets.groups).filter(g => g !== 'property');
    if (groupNames.length < 1 || monthlyAssets.months.length < 2) return;

    const budgetLines = budgetStdout.trim().split('\n');
    if (budgetLines.length < 2) return;

    const budgetHeaderCols = parseCsvLine(budgetLines[0]);
    const budgetIdx = budgetHeaderCols.findIndex(c => c.replace(/"/g, '').trim() === 'budget');
    if (budgetIdx < 0) return;

    const acctNames: string[] = [];
    for (let i = 1; i < budgetLines.length; i++) {
      const cols = parseCsvLine(budgetLines[i]);
      if (cols.length < 3) continue;
      const a = cols[0].trim();
      if ((a.startsWith('income:') && a !== 'income') || (a.startsWith('expenses:') && a !== 'expenses') || (a.startsWith('liabilities:') && a !== 'liabilities')) {
        acctNames.push(a);
      }
    }

    let fullAnnualBudget = 0;
    let fullAnnualIncomeBudget = 0;
    for (let i = 1; i < budgetLines.length; i++) {
      const cols = parseCsvLine(budgetLines[i]);
      if (cols.length < 3) continue;
      const a = cols[0].trim();
      if ((!a.startsWith('income:') && !a.startsWith('expenses:') && !a.startsWith('liabilities:')) || a === 'income' || a === 'expenses' || a === 'liabilities') continue;
      if (acctNames.some(x => x !== a && x.startsWith(a + ':'))) continue;
      const bv = parseAmount(cols[budgetIdx] || '');
      if (a.startsWith('income:')) {
        fullAnnualIncomeBudget += Math.abs(bv.quantity);
      } else {
        fullAnnualBudget += a.startsWith('liabilities:') ? Math.abs(bv.quantity) : bv.quantity;
      }
    }

    const fullMonthlyBudget = fullAnnualBudget / 12;
    const fullMonthlyIncomeBudget = fullAnnualIncomeBudget / 12;
    const pastIncome = chartCurrentMonth >= 0 ? monthly.income.slice(0, chartCurrentMonth + 1) : [];
    const avgIncome = pastIncome.length > 0 ? pastIncome.reduce((s: number, v: number) => s + v, 0) / pastIncome.length : 0;
    const netDelta = fullMonthlyIncomeBudget > 0 ? fullMonthlyIncomeBudget - fullMonthlyBudget : avgIncome - fullMonthlyBudget;

    const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const expenseActual: (number | null)[] = new Array(12).fill(null);
    const expensePredicted: (number | null)[] = new Array(12).fill(null);

    const groupActual: Record<string, (number | null)[]> = {};
    const groupPredicted: Record<string, (number | null)[]> = {};
    for (const g of groupNames) {
      groupActual[g] = new Array(12).fill(null);
      groupPredicted[g] = new Array(12).fill(null);
    }

    for (let i = 0; i < 12 && i < monthlyAssets.months.length; i++) {
      if (i <= chartCurrentMonth) {
        expenseActual[i] = (monthly.expenses[i] || 0) + (monthly.liabilities[i] || 0);
        for (const g of groupNames) {
          groupActual[g][i] = monthlyAssets.groups[g]?.[i] || 0;
        }
      }
      if (i >= chartCurrentMonth) {
        const futExp = i > chartCurrentMonth ? (monthly.expenses[i] || 0) : 0;
        const futLiab = i > chartCurrentMonth ? Math.abs(monthly.liabilities[i] || 0) : 0;
        const exp = i === chartCurrentMonth ? (monthly.expenses[i] || 0) + (monthly.liabilities[i] || 0) : fullMonthlyBudget + futExp + futLiab;
        expensePredicted[i] = exp;
      }
    }

    for (const g of groupNames) {
      const predStart = Math.max(0, chartCurrentMonth);
      const startVal = chartCurrentMonth >= 0 ? (groupActual[g][chartCurrentMonth] ?? 0) : 0;
      groupPredicted[g][predStart] = startVal;
      if (g === 'bank') {
        for (let i = predStart + 1; i < 12; i++) {
          const prevActual = monthlyAssets.groups[g]?.[i - 1] ?? null;
          const currActual = monthlyAssets.groups[g]?.[i] ?? null;
          if (prevActual !== null && currActual !== null) {
            const actualDelta = currActual - prevActual;
            if (actualDelta !== 0) {
              groupPredicted[g][i] = (groupPredicted[g][i - 1] ?? 0) + actualDelta;
              continue;
            }
          }
          groupPredicted[g][i] = (groupPredicted[g][i - 1] ?? 0) + netDelta;
        }
      } else {
        for (let i = predStart + 1; i < 12; i++) {
          groupPredicted[g][i] = startVal;
        }
      }
    }

    container.createEl('h3', { text: 'Asset Balance vs Expense Forecast' });
    container.createEl('br');
    const forecastContainer = container.createDiv({ cls: 'hldg-chart-mount' });

    const datasets: {
      label: string;
      data: (number | null)[];
      borderColor: string;
      backgroundColor: string;
      fill: boolean;
      borderDash?: number[];
    }[] = [];

    groupNames.forEach((g, i) => {
      const color = g === 'bank' ? '#7aa2f7' : PALETTE[(i + 3) % PALETTE.length];
      datasets.push({
        label: g.charAt(0).toUpperCase() + g.slice(1),
        data: groupActual[g],
        borderColor: color,
        backgroundColor: color + '33',
        fill: true,
      });
    });

    datasets.push({
      label: 'Expenses',
      data: expenseActual,
      borderColor: '#f7768e',
      backgroundColor: '#f7768e33',
      fill: true,
    });

    if (chartCurrentMonth < 11) {
      groupNames.forEach((g, i) => {
        const color = g === 'bank' ? '#7aa2f7' : PALETTE[(i + 3) % PALETTE.length];
        datasets.push({
          label: g.charAt(0).toUpperCase() + g.slice(1) + ' (predicted)',
          data: groupPredicted[g],
          borderColor: color,
          backgroundColor: color + '15',
          fill: true,
          borderDash: [4, 4],
        });
      });
      datasets.push({
        label: 'Expenses (predicted)',
        data: expensePredicted,
        borderColor: '#f7768e',
        backgroundColor: '#f7768e15',
        fill: true,
        borderDash: [4, 4],
      });
    }

    createLineChart(forecastContainer, monthLabels, datasets);
  } catch (_e) {
    // forecast chart failed silently
  }
}
