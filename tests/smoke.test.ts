import { execFile } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { HledgerClient } from '../src/hledger/client';
import { extractFromJson, extractMonthlyData, extractRegister } from '../src/hledger/parse';
import { getBalances } from '../src/hledger/queries';

const runIntegration = !!process.env.RUN_INTEGRATION;

describe.skipIf(!runIntegration)('hledger binary smoke', () => {
  const vaultRoot = process.cwd();
  const journalFile = 'sample.journal';
  const binaryPath = 'hledger';
  const client = new HledgerClient(vaultRoot);

  beforeAll(async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        execFile('which', ['hledger'], (err) => {
          if (err) reject(new Error('hledger not found on PATH'));
          else resolve();
        });
      });
    } catch (e) {
      throw new Error(
        `hledger not available — set RUN_INTEGRATION=1 only if hledger 1.52+ is installed: ${e}`,
      );
    }
  });

  it('testConnection returns a version string', async () => {
    const version = await client.testConnection(binaryPath);
    expect(version).toMatch(/hledger \d/);
  });

  it('getCommodities returns non-empty list containing $', async () => {
    const commodities = await client.getCommodities(binaryPath, journalFile);
    expect(commodities.length).toBeGreaterThan(0);
    expect(commodities).toContain('$');
  });

  it('getAvailableYears returns ascending years', async () => {
    const years = await client.getAvailableYears(binaryPath, journalFile);
    expect(years.length).toBeGreaterThan(0);
    for (let i = 1; i < years.length; i++) {
      expect(years[i]).toBe(years[i - 1] + 1);
    }
  });

  it('extractFromJson parses live balance output', async () => {
    const stdout = await client.exec(
      binaryPath,
      ['balance', '-O', 'json', '--no-total', '--tree', '-H'],
      journalFile,
    );
    const entries = extractFromJson(stdout);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(typeof e.amount).toBe('number');
      expect(e.account).toBeTruthy();
    }
  });

  it('getBalances integration', async () => {
    const entries = await getBalances(
      client,
      binaryPath,
      journalFile,
      ['^assets:', '^liabilities:'],
      null,
      true,
      true,
    );
    expect(entries.length).toBeGreaterThan(0);
  });

  it('extractRegister parses live register output', async () => {
    const stdout = await client.exec(
      binaryPath,
      ['register', '-O', 'json', '--depth', '3'],
      journalFile,
    );
    const entries = extractRegister(stdout);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('extractMonthlyData parses monthly report', async () => {
    const stdout = await client.exec(
      binaryPath,
      [
        'balance',
        '^income:',
        '^expenses:',
        '--depth',
        '1',
        '--monthly',
        '-p',
        '2024-01-01..2024-12-31',
        '-O',
        'json',
      ],
      journalFile,
    );
    const data = extractMonthlyData(stdout);
    expect(data.months.length).toBeGreaterThan(0);
    expect(data.income.length).toBe(data.months.length);
    expect(data.expenses.length).toBe(data.months.length);
  });
});
