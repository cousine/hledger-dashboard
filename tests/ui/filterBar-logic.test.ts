import { describe, it, expect } from 'vitest';
import { chipClass, currencyChipClass } from '../../src/ui/filterBar';

describe('chipClass', () => {
  it('classifies income patterns', () => {
    expect(chipClass('^income:')).toBe('hldg-filter-chip-income');
    expect(chipClass('income:salary')).toBe('hldg-filter-chip-income');
  });

  it('classifies expenses patterns', () => {
    expect(chipClass('^expenses:')).toBe('hldg-filter-chip-expenses');
    expect(chipClass('expenses:food')).toBe('hldg-filter-chip-expenses');
  });

  it('classifies assets patterns', () => {
    expect(chipClass('^assets:bank')).toBe('hldg-filter-chip-assets');
    expect(chipClass('assets:bank:checking')).toBe('hldg-filter-chip-assets');
  });

  it('classifies liabilities patterns', () => {
    expect(chipClass('^liabilities:')).toBe('hldg-filter-chip-liabilities');
    expect(chipClass('liabilities:creditcard')).toBe('hldg-filter-chip-liabilities');
  });

  it('classifies equity patterns', () => {
    expect(chipClass('equity:opening')).toBe('hldg-filter-chip-equity');
  });

  it('defaults for unknown', () => {
    expect(chipClass('custom:account')).toBe('hldg-filter-chip-default');
  });
});

describe('currencyChipClass', () => {
  it('classifies $ and USD as usd', () => {
    expect(currencyChipClass('$')).toBe('hldg-filter-chip-currency-usd');
    expect(currencyChipClass('USD')).toBe('hldg-filter-chip-currency-usd');
  });

  it('classifies EUR as eur', () => {
    expect(currencyChipClass('EUR')).toBe('hldg-filter-chip-currency-eur');
  });

  it('classifies others as other', () => {
    expect(currencyChipClass('GBP')).toBe('hldg-filter-chip-currency-other');
    expect(currencyChipClass('JPY')).toBe('hldg-filter-chip-currency-other');
  });
});
