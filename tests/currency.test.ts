import { describe, expect, it } from 'vitest';
import {
  commodityList,
  groupByCommodity,
  groupByDepth,
  groupByTopLevel,
  sumAll,
  sumGroup,
} from '../src/currency';
import type { BalanceEntry } from '../src/hledger/types';

const entries: BalanceEntry[] = [
  { account: 'assets:bank:checking', amount: 5000, commodity: '$', depth: 2 },
  { account: 'assets:bank:savings', amount: 10000, commodity: '$', depth: 2 },
  { account: 'liabilities:creditcard', amount: -500, commodity: '$', depth: 2 },
  { account: 'assets:investment', amount: 5000, commodity: '€', depth: 2 },
];

describe('groupByDepth', () => {
  it('groups accounts by the specified depth', () => {
    const groups = groupByDepth(entries, 1);
    expect(groups.has('assets:bank')).toBe(true);
    expect(groups.has('liabilities:creditcard')).toBe(true);
    expect(groups.get('assets:bank')?.length).toBe(2);
  });

  it('skips entries with undefined depth', () => {
    const withUndefined: BalanceEntry[] = [
      ...entries,
      { account: 'extra', amount: 0, commodity: '$' },
    ];
    expect(groupByDepth(withUndefined, 1).size).toBe(3);
  });

  it('skips accounts shallower than target depth + 1', () => {
    const shallow: BalanceEntry[] = [{ account: 'assets', amount: 0, commodity: '$', depth: 0 }];
    expect(groupByDepth(shallow, 1).size).toBe(0);
  });
});

describe('groupByTopLevel', () => {
  it('groups by top-level account segment', () => {
    const groups = groupByTopLevel(entries);
    expect(groups.has('assets')).toBe(true);
    expect(groups.has('liabilities')).toBe(true);
    expect(groups.get('assets')?.length).toBe(3);
  });
});

describe('sumGroup', () => {
  it('sums all amounts when no commodity filter', () => {
    expect(sumGroup(entries)).toBe(19500);
  });

  it('sums only matching commodity when specified', () => {
    expect(sumGroup(entries, '$')).toBe(14500);
  });

  it('returns 0 for empty entries', () => {
    expect(sumGroup([])).toBe(0);
  });
});

describe('sumAll', () => {
  it('sums all amounts', () => {
    expect(sumAll(entries)).toBe(19500);
  });
});

describe('groupByCommodity', () => {
  it('groups entries by commodity', () => {
    const groups = groupByCommodity(entries);
    expect(groups.has('$')).toBe(true);
    expect(groups.has('€')).toBe(true);
    expect(groups.get('$')?.length).toBe(3);
    expect(groups.get('€')?.length).toBe(1);
  });
});

describe('commodityList', () => {
  it('returns unique commodities in order', () => {
    const list = commodityList(entries);
    expect(list).toContain('$');
    expect(list).toContain('€');
    expect(list.length).toBe(2);
  });
});
