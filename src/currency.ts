import type { BalanceEntry } from './hledger/types';

export function groupByDepth(
  entries: BalanceEntry[],
  targetDepth: number,
): Map<string, BalanceEntry[]> {
  const groups = new Map<string, BalanceEntry[]>();
  for (const e of entries) {
    if (e.depth === undefined) continue;
    const parts = e.account.split(':');
    if (parts.length < targetDepth + 1) continue;
    const parent = parts.slice(0, targetDepth + 1).join(':');
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent)?.push(e);
  }
  return groups;
}

export function groupByTopLevel(entries: BalanceEntry[]): Map<string, BalanceEntry[]> {
  const groups = new Map<string, BalanceEntry[]>();
  for (const e of entries) {
    const top = e.account.split(':')[0];
    if (!groups.has(top)) groups.set(top, []);
    groups.get(top)?.push(e);
  }
  return groups;
}

export function sumGroup(entries: BalanceEntry[], commodity?: string): number {
  return entries
    .filter((e) => !commodity || e.commodity === commodity)
    .reduce((sum, e) => sum + e.amount, 0);
}

export function sumAll(entries: BalanceEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

export function groupByCommodity(entries: BalanceEntry[]): Map<string, BalanceEntry[]> {
  const map = new Map<string, BalanceEntry[]>();
  for (const e of entries) {
    if (!map.has(e.commodity)) map.set(e.commodity, []);
    map.get(e.commodity)?.push(e);
  }
  return map;
}

export function commodityList(entries: BalanceEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) set.add(e.commodity);
  return Array.from(set);
}
