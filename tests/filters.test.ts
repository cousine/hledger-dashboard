import { describe, expect, it } from 'vitest';
import {
  applyCurrencyFilter,
  buildHledgerAccountArgs,
  isEmptyFilter,
  matchPattern,
  shouldDropDepth,
} from '../src/filters';
import type { BalanceEntry } from '../src/hledger/types';

describe('matchPattern', () => {
  it('matches ^ prefix pattern', () => {
    expect(matchPattern('assets:bank', '^assets')).toBe(true);
    expect(matchPattern('liabilities:card', '^assets')).toBe(false);
  });

  it('matches trailing : pattern', () => {
    expect(matchPattern('expenses:food', 'expenses:')).toBe(true);
    expect(matchPattern('income:salary', 'expenses:')).toBe(false);
  });

  it('matches trailing :* pattern', () => {
    expect(matchPattern('expenses:food:dining', 'expenses:*')).toBe(true);
  });

  it('matches exact equality', () => {
    expect(matchPattern('assets:bank', 'assets:bank')).toBe(true);
    expect(matchPattern('assets:bank', 'assets:bank:savings')).toBe(false);
  });

  it('matches prefix: as child accounts', () => {
    expect(matchPattern('assets:bank:savings', 'assets:bank')).toBe(true);
  });
});

describe('applyCurrencyFilter', () => {
  const entries: BalanceEntry[] = [
    { account: 'a', amount: 1, commodity: '$' },
    { account: 'b', amount: 2, commodity: '€' },
    { account: 'c', amount: 3, commodity: '$' },
  ];

  it('returns all entries when currencies list is empty', () => {
    expect(applyCurrencyFilter(entries, [])).toHaveLength(3);
  });

  it('filters by commodity', () => {
    const result = applyCurrencyFilter(entries, ['€']);
    expect(result).toHaveLength(1);
    expect(result[0].commodity).toBe('€');
  });
});

describe('isEmptyFilter', () => {
  it('returns true for empty patterns and currencies', () => {
    expect(isEmptyFilter({ accountPatterns: [], currencies: [] })).toBe(true);
  });

  it('returns false when patterns present', () => {
    expect(isEmptyFilter({ accountPatterns: ['a'], currencies: [] })).toBe(false);
  });
});

describe('buildHledgerAccountArgs', () => {
  it('returns defaults when filter is empty', () => {
    expect(buildHledgerAccountArgs({ accountPatterns: [], currencies: [] }, ['^assets:'])).toEqual([
      '^assets:',
    ]);
  });

  it('returns filter patterns when present', () => {
    expect(
      buildHledgerAccountArgs({ accountPatterns: ['foo', 'bar'], currencies: [] }, ['^assets:']),
    ).toEqual(['foo', 'bar']);
  });
});

describe('shouldDropDepth', () => {
  it('returns true when patterns present', () => {
    expect(shouldDropDepth({ accountPatterns: ['a'], currencies: [] })).toBe(true);
  });

  it('returns false when no patterns', () => {
    expect(shouldDropDepth({ accountPatterns: [], currencies: [] })).toBe(false);
  });
});
