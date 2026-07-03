import { HledgerClient } from './client';
import { BalanceEntry, RegisterEntry, DashboardPeriod } from './types';

function parseAmounts(amounts: any[]): { quantity: number; commodity: string }[] {
  if (!amounts || !Array.isArray(amounts)) return [];
  return amounts.map((a: any) => ({
    quantity: a.aquantity?.floatingPoint ?? 0,
    commodity: a.acommodity || '',
  }));
}

function parseAmount(str: string): { quantity: number; commodity: string } {
  const trimmed = str.trim();
  if (!trimmed || trimmed === '0' || trimmed === '"0"') return { quantity: 0, commodity: '' };

  const dollarMatch = trimmed.match(/^\$(-?[\d,]+\.?\d*)/);
  if (dollarMatch) return { quantity: parseFloat(dollarMatch[1].replace(/,/g, '')), commodity: '$' };

  const egpMatch = trimmed.match(/^([A-Z]+)\s+(-?[\d,]+\.?\d*)/);
  if (egpMatch) return { quantity: parseFloat(egpMatch[2].replace(/,/g, '')), commodity: egpMatch[1] };

  const suffixMatch = trimmed.match(/(-?[\d,]+\.?\d*)\s+(\w+)/);
  if (suffixMatch) return { quantity: parseFloat(suffixMatch[1].replace(/,/g, '')), commodity: suffixMatch[2] };

  const numeric = parseFloat(trimmed.replace(/,/g, ''));
  if (!isNaN(numeric)) return { quantity: numeric, commodity: '' };

  return { quantity: 0, commodity: '' };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function extractFromJson(stdout: string): BalanceEntry[] {
  const raw: any[] = JSON.parse(stdout || '[]');
  const accounts = Array.isArray(raw[0]) ? raw[0] : raw;
  const result: BalanceEntry[] = [];
  for (const entry of accounts) {
    if (!Array.isArray(entry) || entry.length < 4) continue;
    const parsed = parseAmounts(entry[3]);
    for (const p of parsed) {
      result.push({ account: entry[0], amount: p.quantity, commodity: p.commodity, depth: entry[2] });
    }
  }
  return result;
}

export async function getBalances(
  client: HledgerClient,
  binaryPath: string,
  journalFile: string,
  accounts: string[],
  period: DashboardPeriod | null,
  historical: boolean,
  tree: boolean
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
  historical: boolean
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
  period: DashboardPeriod | null
): Promise<RegisterEntry[]> {
  const args: string[] = ['register'];
  if (accountFilter) args.push(accountFilter);
  args.push('-O', 'json');
  if (period) args.push('-p', period.hledgerPeriod);

  const stdout = await client.exec(binaryPath, args, journalFile);
  const raw: any[] = JSON.parse(stdout || '[]');
  const result: RegisterEntry[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 4) continue;
    const detail = entry[3];
    if (!detail || typeof detail !== 'object') continue;
    const parsed = parseAmounts(detail.pamount || []);
    for (const p of parsed) {
      result.push({ date: entry[0] || '', description: entry[2] || '', account: detail.paccount || '', amount: p.quantity, commodity: p.commodity });
    }
  }
  return result;
}

export async function getBalancesWithBudget(
  client: HledgerClient,
  binaryPath: string,
  journalFile: string,
  period: DashboardPeriod
): Promise<BalanceEntry[]> {
  const args: string[] = ['balance', 'expenses:', '--budget', '-p', period.hledgerPeriod, '-O', 'csv', '--no-total'];
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
  conversionCurrency: string
): Promise<BalanceEntry[]> {
  const args: string[] = ['balance', ...accounts, '-X', conversionCurrency, '-O', 'json', '--no-total'];
  if (historical) args.push('-H');
  if (tree) args.push('--tree');
  if (period) args.push('-p', period.hledgerPeriod);

  const stdout = await client.exec(binaryPath, args, journalFile);
  return extractFromJson(stdout);
}
