import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_UI_STATE, defaultTabFilter } from '../../src/hledger/types';

describe('DEFAULT_SETTINGS', () => {
  it('has required fields', () => {
    expect(DEFAULT_SETTINGS.hledgerPath).toBe('hledger');
    expect(DEFAULT_SETTINGS.targetCurrency).toBe('USD');
    expect(DEFAULT_SETTINGS.knownCurrencies).toEqual(['USD', '$', 'EUR', 'GBP']);
    expect(DEFAULT_SETTINGS.recentTxnCount).toBe(20);
  });
});

describe('DEFAULT_UI_STATE', () => {
  it('has balance-sheet as default tab', () => {
    expect(DEFAULT_UI_STATE.activeTab).toBe('balance-sheet');
  });
});

describe('defaultTabFilter', () => {
  it('returns empty filter', () => {
    expect(defaultTabFilter()).toEqual({ accountPatterns: [], currencies: [] });
  });
});
