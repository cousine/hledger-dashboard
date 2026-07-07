import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HledgerClient } from '../../src/hledger/client';

type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void;

const mockExecFile = vi.hoisted(() => vi.fn());
vi.mock('child_process', () => ({
  default: { execFile: mockExecFile },
  execFile: mockExecFile,
}));

const vaultRoot = '/fake/vault';

function makeSuccess(stdout: string) {
  return (_binary: string, _args: string[], _opts: Record<string, unknown>, cb: ExecCallback) =>
    cb(null, stdout, '');
}

function makeError(stderr: string, code = 1) {
  const error = new Error(stderr);
  (error as { code: number }).code = code;
  return (_binary: string, _args: string[], _opts: Record<string, unknown>, cb: ExecCallback) =>
    cb(error, '', stderr);
}

describe('HledgerClient', () => {
  let client: HledgerClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new HledgerClient(vaultRoot);
  });

  describe('exec', () => {
    it('resolves with stdout on success', async () => {
      mockExecFile.mockImplementation(makeSuccess('hello'));
      await expect(client.exec('hledger', ['test'], 'journal.journal')).resolves.toBe('hello');
    });

    it('rejects with stderr on error', async () => {
      mockExecFile.mockImplementation(makeError('Something broke'));
      await expect(client.exec('hledger', ['test'], 'j.journal')).rejects.toThrow(
        'Something broke',
      );
    });

    it('rejects with error.message when stderr empty', async () => {
      const error = new Error('ENOENT');
      mockExecFile.mockImplementation(
        (_b: string, _a: string[], _o: Record<string, unknown>, cb: ExecCallback) =>
          cb(error, '', ''),
      );
      await expect(client.exec('hledger', ['test'], 'j.journal')).rejects.toThrow('ENOENT');
    });

    it('tries fallback paths when default hledger fails', async () => {
      const calls: string[] = [];
      mockExecFile.mockImplementation(
        (binary: string, _args: string[], _opts: Record<string, unknown>, cb: ExecCallback) => {
          calls.push(binary);
          if (binary === 'hledger') {
            cb(new Error('not found'), '', '');
          } else {
            cb(null, 'fallback output', '');
          }
        },
      );
      const result = await client.exec('hledger', ['test'], 'j.journal');
      expect(result).toBe('fallback output');
      expect(calls).toContain('/opt/homebrew/bin/hledger');
    });

    it('does not try fallback for non-default binary path', async () => {
      mockExecFile.mockImplementation(makeError('fail'));
      await expect(client.exec('/custom/hledger', ['test'], 'j.journal')).rejects.toThrow('fail');
    });
  });

  describe('getCommodities', () => {
    it('parses newline-separated commodities', async () => {
      mockExecFile.mockImplementation(makeSuccess('$\nEUR\n'));
      const result = await client.getCommodities('hledger', 'j.journal');
      expect(result).toEqual(['$', 'EUR']);
    });

    it('returns empty array on error', async () => {
      mockExecFile.mockImplementation(makeError('fail'));
      const result = await client.getCommodities('hledger', 'j.journal');
      expect(result).toEqual([]);
    });
  });

  describe('getAccountTree', () => {
    it('returns stdout from accounts --tree', async () => {
      mockExecFile.mockImplementation(makeSuccess('tree output'));
      const result = await client.getAccountTree('hlegder', 'j.journal');
      expect(result).toBe('tree output');
    });
  });

  describe('getAvailableYears', () => {
    it('parses Txns span from stats output', async () => {
      mockExecFile.mockImplementation(makeSuccess('Txns span  : 2024-01-01 to 2026-06-30\n'));
      const result = await client.getAvailableYears('hledger', 'j.journal');
      expect(result).toEqual([2024, 2025, 2026]);
    });

    it('returns empty when year regex does not match', async () => {
      mockExecFile.mockImplementation(makeSuccess('no years'));
      const result = await client.getAvailableYears('hledger', 'j.journal');
      expect(result).toEqual([]);
    });

    it('returns empty on error', async () => {
      mockExecFile.mockImplementation(makeError('fail'));
      const result = await client.getAvailableYears('hledger', 'j.journal');
      expect(result).toEqual([]);
    });
  });

  describe('exec env locale', () => {
    it('does not force ASCII via LC_ALL=C (regression: hGetContents decode error)', async () => {
      mockExecFile.mockImplementation(makeSuccess('ok'));
      await client.exec('hledger', ['accounts'], 'j.journal');
      const opts = mockExecFile.mock.calls[0][2] as {
        env: Record<string, string | undefined>;
      };
      const env = opts.env;
      // LC_ALL overrides every other LC_* category; setting it to 'C'
      // makes the Haskell runtime decode files as ASCII, breaking journals
      // with accented chars / € / £ / etc. (hGetContents decode error).
      expect(env.LC_ALL).toBeUndefined();
      // File I/O must decode as UTF-8 so non-ASCII journals don't fail.
      expect(env.LC_CTYPE).toMatch(/UTF-?8/i);
    });
  });

  describe('testConnection', () => {
    it('resolves with version string', async () => {
      mockExecFile.mockImplementation(makeSuccess('hledger 1.32'));
      const result = await client.testConnection('hledger');
      expect(result).toBe('hledger 1.32');
    });

    it('rejects on failure', async () => {
      mockExecFile.mockImplementation(makeError('not found'));
      await expect(client.testConnection('hledger')).rejects.toThrow('not found');
    });
  });
});
