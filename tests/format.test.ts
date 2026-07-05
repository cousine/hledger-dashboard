import { describe, it, expect } from 'vitest';
import {
  formatAmount,
  formatAmountShort,
  formatDate,
  formatPercentage,
  getColorForAccount,
  PALETTE,
} from '../src/format';

describe('formatAmount', () => {
  it('formats positive $ amounts', () => {
    expect(formatAmount(1234.5, '$')).toBe('$1,234.50');
  });

  it('formats negative $ amounts', () => {
    expect(formatAmount(-500, '$')).toBe('-$500.00');
  });

  it('formats amounts with symbol commodity', () => {
    expect(formatAmount(1000, 'USD')).toBe('USD 1,000.00');
  });

  it('formats negative amounts with symbol commodity', () => {
    expect(formatAmount(-250.5, 'EUR')).toBe('-EUR 250.50');
  });

  it('pads to 2 decimal places', () => {
    expect(formatAmount(5, '$')).toBe('$5.00');
    expect(formatAmount(5.1, '$')).toBe('$5.10');
  });
});

describe('formatAmountShort', () => {
  it('formats millions with M suffix', () => {
    expect(formatAmountShort(1500000, '$')).toBe('$1.5M');
  });

  it('formats thousands with K suffix', () => {
    expect(formatAmountShort(2500, '$')).toBe('$3K');
  });

  it('formats small amounts with full precision', () => {
    expect(formatAmountShort(999.99, '$')).toBe('$999.99');
  });

  it('handles negative with prefix', () => {
    expect(formatAmountShort(-1000000, 'USD')).toBe('-USD 1.0M');
  });
});

describe('formatDate', () => {
  it('converts YYYY-MM-DD to DD/MM', () => {
    expect(formatDate('2024-03-15')).toBe('15/03');
  });

  it('returns empty string for empty input', () => {
    expect(formatDate('')).toBe('');
  });

  it('returns as-is for non-3-part strings', () => {
    expect(formatDate('2024-03')).toBe('2024-03');
  });
});

describe('formatPercentage', () => {
  it('formats with one decimal and %', () => {
    expect(formatPercentage(75.3)).toBe('75.3%');
  });

  it('handles zero', () => {
    expect(formatPercentage(0)).toBe('0.0%');
  });
});

describe('getColorForAccount', () => {
  it('returns a color from PALETTE', () => {
    const color = getColorForAccount('assets:bank');
    expect(PALETTE).toContain(color);
  });

  it('returns the same color for the same input', () => {
    expect(getColorForAccount('expenses:food')).toBe(getColorForAccount('expenses:food'));
  });
});
