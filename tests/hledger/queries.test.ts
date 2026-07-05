import { describe, expect, it, vi } from 'vitest';
import type { HledgerClient } from '../../src/hledger/client';
import {
  getBalances,
  getBalancesFlat,
  getBalancesWithBudget,
  getConvertedBalances,
  getRegister,
} from '../../src/hledger/queries';
import type { DashboardPeriod } from '../../src/hledger/types';
import {
  BALANCE_JSON_EMPTY,
  BALANCE_JSON_TREE,
  BUDGET_CSV,
  BUDGET_CSV_EMPTY,
  REGISTER_JSON,
} from '../fixtures/hledgerOutputs';

function makeClient(stdout: string) {
  return { exec: vi.fn().mockResolvedValue(stdout) } as unknown as HledgerClient;
}

const period: DashboardPeriod = {
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  preset: 'ytd',
  label: 'YTD 2024',
  hledgerPeriod: '2024-01-01..2024-12-31',
};

describe('getBalances', () => {
  it('calls client.exec with correct args and parses result', async () => {
    const client = makeClient(BALANCE_JSON_TREE);
    const result = await getBalances(
      client,
      'hledger',
      'test.journal',
      ['^assets:'],
      period,
      true,
      true,
    );

    expect(client.exec).toHaveBeenCalledWith(
      'hledger',
      [
        'balance',
        '^assets:',
        '-O',
        'json',
        '--no-total',
        '-H',
        '--tree',
        '-p',
        '2024-01-01..2024-12-31',
      ],
      'test.journal',
    );
    expect(result.length).toBeGreaterThan(0);
  });

  it('omits historical and tree when false', async () => {
    const client = makeClient(BALANCE_JSON_EMPTY);
    await getBalances(client, 'hledger', 'test.journal', [], null, false, false);
    expect(client.exec).toHaveBeenCalledWith(
      'hledger',
      ['balance', '-O', 'json', '--no-total'],
      'test.journal',
    );
  });
});

describe('getBalancesFlat', () => {
  it('calls with flat args', async () => {
    const client = makeClient(BALANCE_JSON_TREE);
    const result = await getBalancesFlat(
      client,
      'hledger',
      'test.journal',
      'expenses:',
      period,
      false,
    );

    expect(client.exec).toHaveBeenCalledWith(
      'hledger',
      ['balance', 'expenses:', '-O', 'json', '--no-total', '-p', '2024-01-01..2024-12-31'],
      'test.journal',
    );
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('getRegister', () => {
  it('parses register JSON', async () => {
    const client = makeClient(REGISTER_JSON);
    const result = await getRegister(client, 'hledger', 'test.journal', null, period);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('date');
    expect(result[0]).toHaveProperty('amount');
  });
});

describe('getBalancesWithBudget', () => {
  it('parses budget CSV', async () => {
    const client = makeClient(BUDGET_CSV);
    const result = await getBalancesWithBudget(client, 'hledger', 'test.journal', period);

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((e) => e.isBudget)).toBe(true);
  });

  it('returns empty when budget column missing', async () => {
    const client = makeClient(BUDGET_CSV_EMPTY);
    const result = await getBalancesWithBudget(client, 'hledger', 'test.journal', period);
    expect(result).toEqual([]);
  });
});

describe('getConvertedBalances', () => {
  it('adds -X flag', async () => {
    const client = makeClient(BALANCE_JSON_TREE);
    const result = await getConvertedBalances(
      client,
      'hledger',
      'test.journal',
      ['^assets:'],
      period,
      true,
      true,
      'EUR',
    );

    expect(client.exec).toHaveBeenCalledWith(
      'hledger',
      [
        'balance',
        '^assets:',
        '-X',
        'EUR',
        '-O',
        'json',
        '--no-total',
        '-H',
        '--tree',
        '-p',
        '2024-01-01..2024-12-31',
      ],
      'test.journal',
    );
    expect(Array.isArray(result)).toBe(true);
  });
});
