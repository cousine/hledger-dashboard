import type { BalanceEntry, RegisterEntry } from './types';

interface HledgerAmount {
  aquantity?: { floatingPoint?: number };
  acommodity?: string;
}

interface HledgerPosting {
  paccount?: string;
  pamount?: HledgerAmount[];
}

interface HledgerRegisterDetail {
  paccount?: string;
  pamount?: HledgerAmount[];
}

interface HledgerTxn {
  pdate?: string;
  tdate?: string;
  pdescription?: string;
  tdescription?: string;
  ppostings?: HledgerPosting[];
  tpostings?: HledgerPosting[];
}

interface HledgerPeriodRow {
  prrName?: string;
  prrAmounts?: HledgerAmount[][];
}

interface HledgerPeriodReport {
  prDates?: { 0?: { contents?: string } }[];
  prRows?: HledgerPeriodRow[];
}

export function parseAmount(str: string): { quantity: number; commodity: string } {
  const trimmed = str.trim();
  if (!trimmed || trimmed === '0' || trimmed === '"0"') return { quantity: 0, commodity: '' };

  const dollarMatch = trimmed.match(/^\$(-?[\d,]+\.?\d*)/);
  if (dollarMatch)
    return { quantity: parseFloat(dollarMatch[1].replace(/,/g, '')), commodity: '$' };

  const egpMatch = trimmed.match(/^([A-Z]+)\s+(-?[\d,]+\.?\d*)/);
  if (egpMatch)
    return { quantity: parseFloat(egpMatch[2].replace(/,/g, '')), commodity: egpMatch[1] };

  const suffixMatch = trimmed.match(/(-?[\d,]+\.?\d*)\s+(\w+)/);
  if (suffixMatch)
    return { quantity: parseFloat(suffixMatch[1].replace(/,/g, '')), commodity: suffixMatch[2] };

  const numeric = parseFloat(trimmed.replace(/,/g, ''));
  if (!Number.isNaN(numeric)) return { quantity: numeric, commodity: '' };

  return { quantity: 0, commodity: '' };
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function parseAmounts(amounts: HledgerAmount[]): { quantity: number; commodity: string }[] {
  if (!amounts || !Array.isArray(amounts)) return [];
  return amounts.map((a) => ({
    quantity: a.aquantity?.floatingPoint ?? 0,
    commodity: a.acommodity || '',
  }));
}

export function extractFromJson(stdout: string): BalanceEntry[] {
  const raw: unknown[][] = JSON.parse(stdout || '[]');
  const accounts = Array.isArray(raw[0]) ? (raw[0] as unknown[][]) : raw;
  const result: BalanceEntry[] = [];
  for (const entry of accounts) {
    if (!Array.isArray(entry) || entry.length < 4) continue;
    const parsed = parseAmounts(entry[3] as HledgerAmount[]);
    for (const p of parsed) {
      result.push({
        account: entry[0] as string,
        amount: p.quantity,
        commodity: p.commodity,
        depth: (entry[2] as number) ?? 0,
      });
    }
  }
  return result;
}

export function extractFlat(stdout: string): BalanceEntry[] {
  const raw: unknown[][] = JSON.parse(stdout || '[]');
  const entries = Array.isArray(raw[0]) ? (raw[0] as unknown[][]) : raw;
  const out: BalanceEntry[] = [];
  for (const e of entries) {
    if (!Array.isArray(e) || e.length < 4) continue;
    const parsed = parseAmounts(e[3] as HledgerAmount[]);
    for (const p of parsed) {
      out.push({
        account: e[0] as string,
        amount: p.quantity,
        commodity: p.commodity,
        depth: (e[2] as number) ?? 0,
      });
    }
  }
  return out;
}

export function extractMonthlyTrend(stdout: string): {
  months: string[];
  income: number[];
  expenses: number[];
} {
  const report: HledgerPeriodReport = JSON.parse(stdout || '[]');
  const r: HledgerPeriodReport = Array.isArray(report) ? report[0] : report;
  if (!r?.prDates || !r.prRows) return { months: [], income: [], expenses: [] };
  const months = r.prDates.map((dp: { 0?: { contents?: string } }) => {
    const d = dp[0]?.contents || '';
    return d.substring(0, 7);
  });
  const income = new Array(months.length).fill(0);
  const expenses = new Array(months.length).fill(0);
  for (const row of r.prRows) {
    const name: string = row.prrName || '';
    for (let i = 0; i < (row.prrAmounts?.length ?? 0) && i < months.length; i++) {
      const amtPairs = row.prrAmounts?.[i];
      let val = 0;
      if (Array.isArray(amtPairs)) {
        val = amtPairs.reduce(
          (s: number, a: HledgerAmount) => s + (a.aquantity?.floatingPoint ?? 0),
          0,
        );
      }
      if (name === 'income' || name.startsWith('income:')) income[i] -= val;
      else if (name === 'expenses' || name.startsWith('expenses:')) expenses[i] += val;
    }
  }
  return { months, income, expenses };
}

export function extractBalanceTimeSeries(stdout: string): {
  months: string[];
  accounts: Record<string, number[]>;
} {
  const report = JSON.parse(stdout);
  const r: HledgerPeriodReport = Array.isArray(report) ? report[0] : report;
  if (!r?.prDates || !r.prRows) return { months: [], accounts: {} };
  const months = r.prDates.map((dp: { 0?: { contents?: string } }) => {
    const d = dp[0]?.contents || '';
    return d.substring(0, 7);
  });
  const accounts: Record<string, number[]> = {};
  for (const row of r.prRows) {
    const name: string = row.prrName || '';
    const vals = new Array(months.length).fill(0);
    for (let i = 0; i < (row.prrAmounts?.length ?? 0) && i < months.length; i++) {
      const amtPairs = row.prrAmounts?.[i];
      if (Array.isArray(amtPairs)) {
        vals[i] = amtPairs.reduce(
          (s: number, a: HledgerAmount) => s + (a.aquantity?.floatingPoint ?? 0),
          0,
        );
      }
    }
    accounts[name] = vals;
  }
  return { months, accounts };
}

export function extractMonthlyData(stdout: string): {
  months: string[];
  income: number[];
  expenses: number[];
  liabilities: number[];
} {
  const report = JSON.parse(stdout);
  const r = Array.isArray(report) ? report[0] : report;
  if (!r?.prDates || !r.prRows) return { months: [], income: [], expenses: [], liabilities: [] };
  const months = r.prDates.map((dp: { 0?: { contents?: string } }) => {
    const d = dp[0]?.contents || '';
    return d.substring(0, 7);
  });
  const income = new Array(months.length).fill(0);
  const expenses = new Array(months.length).fill(0);
  const liabilities = new Array(months.length).fill(0);
  for (const row of r.prRows) {
    const name: string = row.prrName || '';
    for (let i = 0; i < (row.prrAmounts?.length ?? 0) && i < months.length; i++) {
      const amtPairs = row.prrAmounts?.[i];
      let val = 0;
      if (Array.isArray(amtPairs)) {
        val = amtPairs.reduce(
          (s: number, a: HledgerAmount) => s + (a.aquantity?.floatingPoint ?? 0),
          0,
        );
      }
      if (name === 'income' || name.startsWith('income:')) income[i] -= val;
      else if (name === 'expenses' || name.startsWith('expenses:')) expenses[i] += val;
      else if (name === 'liabilities' || name.startsWith('liabilities:')) liabilities[i] += val;
    }
  }
  return { months, income, expenses, liabilities };
}

export function extractMonthlyAssetsByGroup(stdout: string): {
  months: string[];
  groups: Record<string, number[]>;
} {
  const report = JSON.parse(stdout);
  const r = Array.isArray(report) ? report[0] : report;
  if (!r?.prDates || !r.prRows) return { months: [], groups: {} };
  const months = r.prDates.map((dp: { 0?: { contents?: string } }) => {
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
          vals[i] = amtPairs.reduce(
            (s: number, a: HledgerAmount) => s + (a.aquantity?.floatingPoint ?? 0),
            0,
          );
        }
      }
      groups[groupName] = vals;
    }
  }
  return { months, groups };
}

export function extractMonthlyAmounts(stdout: string): { months: string[]; amounts: number[] } {
  const report: HledgerPeriodReport = JSON.parse(stdout);
  const r: HledgerPeriodReport = Array.isArray(report) ? report[0] : report;
  if (!r?.prDates || !r.prRows) return { months: [], amounts: [] };
  const months = r.prDates.map((dp: { 0?: { contents?: string } }) => {
    const d = dp[0]?.contents || '';
    return d.substring(0, 7);
  });
  const amounts = new Array(months.length).fill(0);
  for (const row of r.prRows) {
    for (let i = 0; i < (row.prrAmounts?.length ?? 0) && i < months.length; i++) {
      const amtPairs = row.prrAmounts?.[i];
      if (Array.isArray(amtPairs)) {
        amounts[i] += amtPairs.reduce(
          (s: number, a: HledgerAmount) => s + Math.abs(a.aquantity?.floatingPoint ?? 0),
          0,
        );
      }
    }
  }
  return { months, amounts };
}

export interface TransferLeg {
  date: string;
  description: string;
  account: string;
  amount: number;
  commodity: string;
}

export function parsePrintTransfers(stdout: string): TransferLeg[] {
  const raw: HledgerTxn[] = JSON.parse(stdout || '[]');
  const txns = Array.isArray(raw) ? raw : [];
  const result: TransferLeg[] = [];
  for (const txn of txns) {
    const date: string = txn.pdate || txn.tdate || '';
    const desc: string = txn.pdescription || txn.tdescription || '';
    const postings: HledgerPosting[] = txn.ppostings || txn.tpostings || [];
    for (const posting of postings) {
      const account: string = posting.paccount || posting.paccount || '';
      if (account === 'equity:transfer') continue;
      const amountData = posting.pamount || posting.pamount || [];
      for (const amt of amountData) {
        const qty = amt.aquantity?.floatingPoint;
        if (qty === undefined || qty === 0) continue;
        if (typeof qty !== 'number' || Number.isNaN(qty)) continue;
        result.push({
          date,
          description: desc,
          account,
          amount: qty,
          commodity: amt.acommodity || '',
        });
      }
    }
  }
  return result;
}

export function extractRegister(stdout: string): RegisterEntry[] {
  const raw: unknown[][] = JSON.parse(stdout || '[]');
  const result: RegisterEntry[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 4) continue;
    const detail = entry[3] as HledgerRegisterDetail;
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

export function getTxnType(account: string, amount: number): 'Credit' | 'Debit' {
  if ((account.startsWith('expenses:') || account.startsWith('expenses')) && amount > 0)
    return 'Debit';
  if ((account.startsWith('income:') || account.startsWith('income')) && amount < 0)
    return 'Credit';
  return amount >= 0 ? 'Credit' : 'Debit';
}

export function groupBreakdown(
  entries: BalanceEntry[],
  prefix: string,
  depth: number,
): { labels: string[]; data: number[] } {
  const groups = new Map<string, number>();
  for (const e of entries) {
    if (e.account.startsWith(prefix)) {
      const parts = e.account.slice(prefix.length).split(':');
      const label = parts.slice(0, depth).join(':') || e.account;
      groups.set(label, (groups.get(label) || 0) + Math.abs(e.amount));
    }
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1]);
  return { labels: sorted.map((s) => s[0]), data: sorted.map((s) => s[1]) };
}

export function isLeaf(account: string, allAccounts: string[]): boolean {
  return !allAccounts.some((a) => a.startsWith(`${account}:`));
}

export function makeCacheKey(ctx: {
  filter: { accountPatterns: string[]; currencies: string[] };
  period: { hledgerPeriod: string };
}): string {
  const filter = ctx.filter;
  return JSON.stringify({
    accounts: [...filter.accountPatterns].sort(),
    currencies: [...filter.currencies].sort(),
    period: ctx.period.hledgerPeriod,
  });
}
