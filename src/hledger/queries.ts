import type { HledgerClient } from './client';
import { extractFromJson, parseAmount, parseAmounts, parseCsvLine } from './parse';
import type { BalanceEntry, DashboardPeriod, RegisterEntry } from './types';

export async function getBalances(
  client: HledgerClient,
  binaryPath: string,
  journalFile: string,
  accounts: string[],
  period: DashboardPeriod | null,
  historical: boolean,
  tree: boolean,
): Promise<BalanceEntry[]> {
  const args: string[] = ['balance', ...accounts, '-O', 'json', '--no-total'];
  if (historical) args.push('-H');
  if (tree) args.push('--tree');
  if (period) args.push('-p', period.hledgerPeriod);

  const stdout = await client.exec(binaryPath, args, journalFile);
  return extractFromJson(stdout);
}

export async function getBalancesFlat(
  client: HledgerClient,
  binaryPath: string,
  journalFile: string,
  accountFilter: string,
  period: DashboardPeriod | null,
  historical: boolean,
): Promise<BalanceEntry[]> {
  const args: string[] = ['balance', accountFilter, '-O', 'json', '--no-total'];
  if (historical) args.push('-H');
  if (period) args.push('-p', period.hledgerPeriod);

  const stdout = await client.exec(binaryPath, args, journalFile);
  return extractFromJson(stdout);
}

export async function getRegister(
  client: HledgerClient,
  binaryPath: string,
  journalFile: string,
  accountFilter: string | null,
  period: DashboardPeriod | null,
): Promise<RegisterEntry[]> {
  const args: string[] = ['register'];
  if (accountFilter) args.push(accountFilter);
  args.push('-O', 'json');
  if (period) args.push('-p', period.hledgerPeriod);

  const stdout = await client.exec(binaryPath, args, journalFile);
  const raw: unknown[][] = JSON.parse(stdout || '[]');
  const result: RegisterEntry[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 4) continue;
    const detail = entry[3] as {
      paccount?: string;
      pamount?: { aquantity?: { floatingPoint?: number }; acommodity?: string }[];
    };
    if (!detail || typeof detail !== 'object') continue;
    const parsed = parseAmounts(detail.pamount || []);
    for (const p of parsed) {
      result.push({
        date: (entry[0] as string) || '',
        description: (entry[2] as string) || '',
        account: detail.paccount || '',
        amount: p.quantity,
        commodity: p.commodity,
      });
    }
  }
  return result;
}

export async function getBalancesWithBudget(
  client: HledgerClient,
  binaryPath: string,
  journalFile: string,
  period: DashboardPeriod,
): Promise<BalanceEntry[]> {
  const args: string[] = [
    'balance',
    'expenses:',
    '--budget',
    '-p',
    period.hledgerPeriod,
    '-O',
    'csv',
    '--no-total',
  ];
  const stdout = await client.exec(binaryPath, args, journalFile);
  const lines = stdout.trim().split('\n');
  if (lines.length < 2) return [];

  const headerCols = parseCsvLine(lines[0]);
  const budgetColIdx = headerCols.findIndex((c) => c.replace(/"/g, '').trim() === 'budget');
  if (budgetColIdx < 0) return [];

  const result: BalanceEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 3) continue;
    const account = cols[0].trim();
    const actualCol = cols[budgetColIdx === 1 ? 2 : 1] || '';
    const budgetCol = cols[budgetColIdx] || '';
    const actual = parseAmount(actualCol);
    const budget = parseAmount(budgetCol);
    if (budget.quantity === 0 && actual.quantity === 0) continue;
    if (!account.startsWith('expenses:') || account === 'expenses') continue;
    result.push({
      account,
      amount: actual.quantity,
      commodity: actual.commodity || '',
      isBudget: budget.quantity > 0,
      budgetAmount: budget.quantity,
    });
  }
  return result;
}

export async function getConvertedBalances(
  client: HledgerClient,
  binaryPath: string,
  journalFile: string,
  accounts: string[],
  period: DashboardPeriod | null,
  historical: boolean,
  tree: boolean,
  conversionCurrency: string,
): Promise<BalanceEntry[]> {
  const args: string[] = [
    'balance',
    ...accounts,
    '-X',
    conversionCurrency,
    '-O',
    'json',
    '--no-total',
  ];
  if (historical) args.push('-H');
  if (tree) args.push('--tree');
  if (period) args.push('-p', period.hledgerPeriod);

  const stdout = await client.exec(binaryPath, args, journalFile);
  return extractFromJson(stdout);
}
