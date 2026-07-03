import { BalanceEntry, TabFilterState } from './hledger/types';

export function matchPattern(accountName: string, pattern: string): boolean {
  if (pattern.startsWith('^')) return accountName.startsWith(pattern.substring(1));
  if (pattern.endsWith(':')) return accountName.startsWith(pattern);
  if (pattern.endsWith(':*')) return accountName.startsWith(pattern.slice(0, -2) + ':');
  return accountName === pattern || accountName.startsWith(pattern + ':');
}

export function applyCurrencyFilter(
  entries: BalanceEntry[],
  currencies: string[]
): BalanceEntry[] {
  if (!currencies || currencies.length === 0) return entries;
  return entries.filter((e) => currencies.includes(e.commodity));
}

export function isEmptyFilter(filter: TabFilterState): boolean {
  return filter.accountPatterns.length === 0 && filter.currencies.length === 0;
}

export function buildHledgerAccountArgs(
  filter: TabFilterState,
  defaults: string[]
): string[] {
  if (filter.accountPatterns.length === 0) return defaults;
  return filter.accountPatterns;
}

export function shouldDropDepth(filter: TabFilterState): boolean {
  return filter.accountPatterns.length > 0;
}
