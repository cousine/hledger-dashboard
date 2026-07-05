import { describe, expect, it } from 'vitest';
import {
  extractBalanceTimeSeries,
  extractFlat,
  extractFromJson,
  extractMonthlyAmounts,
  extractMonthlyAssetsByGroup,
  extractMonthlyData,
  extractMonthlyTrend,
  extractRegister,
  getTxnType,
  groupBreakdown,
  isLeaf,
  makeCacheKey,
  parseAmount,
  parseCsvLine,
  parsePrintTransfers,
} from '../../src/hledger/parse';
import {
  BALANCE_FLAT_MULTI_COMMODITY,
  BALANCE_JSON_EMPTY,
  BALANCE_JSON_TREE,
  MONTHLY_ASSETS_JSON,
  MONTHLY_BALANCE_SHEET_JSON,
  MONTHLY_BUDGET_REPORT_JSON,
  MONTHLY_REPORT_JSON,
  PRINT_TRANSFERS_JSON,
  REGISTER_JSON,
} from '../fixtures/hledgerOutputs';

describe('parseAmount', () => {
  it('parses $ prefix amounts', () => {
    expect(parseAmount('$1,234.50')).toEqual({ quantity: 1234.5, commodity: '$' });
  });

  it('parses negative $ amounts', () => {
    expect(parseAmount('$-500.00')).toEqual({ quantity: -500, commodity: '$' });
  });

  it('parses symbol prefix amounts', () => {
    expect(parseAmount('USD 1,000')).toEqual({ quantity: 1000, commodity: 'USD' });
  });

  it('parses suffix amounts', () => {
    expect(parseAmount('100 EUR')).toEqual({ quantity: 100, commodity: 'EUR' });
  });

  it('parses bare numeric with commas', () => {
    expect(parseAmount('1,234.56')).toEqual({ quantity: 1234.56, commodity: '' });
  });

  it('returns zero for empty string', () => {
    expect(parseAmount('')).toEqual({ quantity: 0, commodity: '' });
  });

  it('returns zero for "0"', () => {
    expect(parseAmount('0')).toEqual({ quantity: 0, commodity: '' });
  });

  it('returns zero for quoted zero', () => {
    expect(parseAmount('"0"')).toEqual({ quantity: 0, commodity: '' });
  });

  it('returns zero for unparseable string', () => {
    expect(parseAmount('notanumber')).toEqual({ quantity: 0, commodity: '' });
  });
});

describe('parseCsvLine', () => {
  it('parses simple comma-separated values', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields with commas', () => {
    expect(parseCsvLine('"a,b",c')).toEqual(['a,b', 'c']);
  });

  it('handles trailing empty field', () => {
    expect(parseCsvLine('a,')).toEqual(['a', '']);
  });
});

describe('extractFromJson', () => {
  it('parses tree balance JSON', () => {
    const result = extractFromJson(BALANCE_JSON_TREE);
    expect(result.length).toBeGreaterThan(0);
    const assets = result.find((e) => e.account === 'assets');
    expect(assets).toBeDefined();
    expect(assets?.amount).toBe(15000);
    expect(assets?.commodity).toBe('$');
  });

  it('handles empty JSON', () => {
    expect(extractFromJson(BALANCE_JSON_EMPTY)).toEqual([]);
  });

  it('skips malformed entries (length < 4)', () => {
    const malformed = JSON.stringify([
      [
        ['a', 'b'],
        ['c', 'd', 'e', [{ acommodity: '$', aquantity: { floatingPoint: 1 } }]],
      ],
    ]);
    const result = extractFromJson(malformed);
    expect(result).toHaveLength(1);
  });
});

describe('extractFlat', () => {
  it('parses flat balance JSON with multiple commodities', () => {
    const result = extractFlat(BALANCE_FLAT_MULTI_COMMODITY);
    expect(result.length).toBeGreaterThanOrEqual(2);
    const checking = result.find(
      (e) => e.account === 'assets:bank:checking' && e.commodity === '$',
    );
    expect(checking).toBeDefined();
    expect(checking?.amount).toBe(5000);
  });

  it('handles empty JSON', () => {
    expect(extractFlat(BALANCE_JSON_EMPTY)).toEqual([]);
  });
});

describe('extractMonthlyTrend', () => {
  it('parses monthly report JSON', () => {
    const result = extractMonthlyTrend(MONTHLY_REPORT_JSON);
    expect(result.months).toEqual(['2024-01', '2024-02']);
    expect(result.income).toHaveLength(2);
    expect(result.expenses).toHaveLength(2);
  });

  it('negates income values', () => {
    const result = extractMonthlyTrend(MONTHLY_REPORT_JSON);
    expect(result.income[0]).toBe(-5000);
    expect(result.expenses[0]).toBe(2000);
  });

  it('returns empty arrays for empty input', () => {
    expect(extractMonthlyTrend('[]')).toEqual({ months: [], income: [], expenses: [] });
  });
});

describe('extractBalanceTimeSeries', () => {
  it('parses balance time series JSON', () => {
    const result = extractBalanceTimeSeries(MONTHLY_BALANCE_SHEET_JSON);
    expect(result.months).toEqual(['2024-01', '2024-02']);
    expect(result.accounts['assets:bank']).toBeDefined();
    expect(result.accounts['liabilities:creditcard']).toBeDefined();
  });

  it('returns empty for empty input', () => {
    expect(extractBalanceTimeSeries('[]').months).toEqual([]);
  });
});

describe('extractMonthlyData', () => {
  it('parses budget monthly JSON with liabilities', () => {
    const result = extractMonthlyData(MONTHLY_BUDGET_REPORT_JSON);
    expect(result.months).toEqual(['2024-01', '2024-02']);
    expect(result.liabilities).toHaveLength(2);
    expect(result.liabilities[0]).toBe(-100);
  });

  it('returns empty for missing prRows', () => {
    expect(extractMonthlyData('[]').months).toEqual([]);
  });
});

describe('extractMonthlyAssetsByGroup', () => {
  it('filters only assets:* rows', () => {
    const result = extractMonthlyAssetsByGroup(MONTHLY_ASSETS_JSON);
    expect(result.groups['bank:checking']).toBeDefined();
    expect(result.groups.investment).toBeDefined();
  });

  it('strips assets: prefix from group names', () => {
    const result = extractMonthlyAssetsByGroup(MONTHLY_ASSETS_JSON);
    expect(result.groups['bank:checking']).toBeDefined();
    expect(result.groups['assets:bank:checking']).toBeUndefined();
    expect(result.groups.investment).toBeDefined();
  });
});

describe('extractMonthlyAmounts', () => {
  it('sums absolute values across all rows', () => {
    const result = extractMonthlyAmounts(MONTHLY_ASSETS_JSON);
    expect(result.months).toEqual(['2024-01', '2024-02']);
    expect(result.amounts[0]).toBe(20000);
    expect(result.amounts[1]).toBe(20000);
  });
});

describe('parsePrintTransfers', () => {
  it('extracts transfer legs skipping equity:transfer', () => {
    const result = parsePrintTransfers(PRINT_TRANSFERS_JSON);
    expect(result).toHaveLength(2);
    expect(result.every((l) => l.account !== 'equity:transfer')).toBe(true);
  });

  it('returns empty for empty array', () => {
    expect(parsePrintTransfers('[]')).toEqual([]);
  });
});

describe('extractRegister', () => {
  it('parses register JSON entries', () => {
    const result = extractRegister(REGISTER_JSON);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('date');
    expect(result[0]).toHaveProperty('description');
    expect(result[0]).toHaveProperty('account');
    expect(result[0]).toHaveProperty('amount');
  });

  it('returns empty for empty input', () => {
    expect(extractRegister('[]')).toEqual([]);
  });
});

describe('getTxnType', () => {
  it('returns Debit for expenses with positive amount', () => {
    expect(getTxnType('expenses:food', 100)).toBe('Debit');
  });

  it('returns Credit for income with negative amount', () => {
    expect(getTxnType('income:salary', -5000)).toBe('Credit');
  });

  it('returns Credit for positive amounts in non-income/expense accounts', () => {
    expect(getTxnType('assets:bank', 100)).toBe('Credit');
  });

  it('returns Debit for negative amounts in non-income/expense accounts', () => {
    expect(getTxnType('assets:bank', -100)).toBe('Debit');
  });
});

describe('groupBreakdown', () => {
  it('groups entries by prefix at given depth', () => {
    const entries = [
      { account: 'expenses:food:dining', amount: 100, depth: 3, commodity: '$' },
      { account: 'expenses:food:groceries', amount: 200, depth: 3, commodity: '$' },
      { account: 'expenses:transport:gas', amount: 50, depth: 3, commodity: '$' },
    ];
    const result = groupBreakdown(entries, 'expenses:', 1);
    expect(result.labels).toEqual(['food', 'transport']);
    expect(result.data[0]).toBe(300);
  });

  it('returns empty for no matches', () => {
    expect(groupBreakdown([], 'expenses:', 1)).toEqual({ labels: [], data: [] });
  });
});

describe('isLeaf', () => {
  it('returns true when no other account starts with account:', () => {
    expect(
      isLeaf('assets:bank:checking', ['assets:bank', 'assets:bank:checking', 'liabilities:card']),
    ).toBe(true);
  });

  it('returns false when other accounts are children', () => {
    expect(isLeaf('assets:bank', ['assets:bank', 'assets:bank:checking'])).toBe(false);
  });
});

describe('makeCacheKey', () => {
  it('produces same key for equivalent filter orders', () => {
    const ctx1 = {
      filter: { accountPatterns: ['b', 'a'], currencies: ['EUR', 'USD'] },
      period: { hledgerPeriod: '2024..2024' },
    };
    const ctx2 = {
      filter: { accountPatterns: ['a', 'b'], currencies: ['USD', 'EUR'] },
      period: { hledgerPeriod: '2024..2024' },
    };
    expect(makeCacheKey(ctx1)).toBe(makeCacheKey(ctx2));
  });

  it('produces different keys for different periods', () => {
    const ctx1 = {
      filter: { accountPatterns: [], currencies: [] },
      period: { hledgerPeriod: '2024..2024' },
    };
    const ctx2 = {
      filter: { accountPatterns: [], currencies: [] },
      period: { hledgerPeriod: '2025..2025' },
    };
    expect(makeCacheKey(ctx1)).not.toBe(makeCacheKey(ctx2));
  });
});
