import { execFile } from 'child_process';
import * as path from 'path';

export class HledgerClient {
  private vaultRoot: string;

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot;
  }

  private async execRaw(
    binaryPath: string,
    args: string[],
    journalFile: string
  ): Promise<string> {
    const journalAbs = path.resolve(this.vaultRoot, journalFile);
    const fullArgs = ['-f', journalAbs, ...args];

    const env = {
      ...process.env,
      PATH: [
        '/opt/homebrew/bin',
        '/usr/local/bin',
        '/opt/homebrew/sbin',
        '/usr/bin',
        '/bin',
        process.env.PATH,
      ]
        .filter(Boolean)
        .join(':'),
    };

    return new Promise((resolve, reject) => {
      execFile(
        binaryPath,
        fullArgs,
        { cwd: this.vaultRoot, env, timeout: 30000, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            const msg = stderr?.trim() || error.message;
            reject(new Error(msg));
          } else {
            resolve(stdout);
          }
        }
      );
    });
  }

  async exec(
    binaryPath: string,
    args: string[],
    journalFile: string
  ): Promise<string> {
    try {
      return await this.execRaw(binaryPath, args, journalFile);
    } catch (err) {
      if (binaryPath !== 'hledger') throw err;
      const fallbacks = [
        '/opt/homebrew/bin/hledger',
        '/usr/local/bin/hledger',
      ];
      for (const fb of fallbacks) {
        try {
          return await this.execRaw(fb, args, journalFile);
        } catch {}
      }
      throw err;
    }
  }

  async getCommodities(
    binaryPath: string,
    journalFile: string
  ): Promise<string[]> {
    try {
      const out = await this.exec(
        binaryPath,
        ['commodities'],
        journalFile
      );
      return out
        .trim()
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  async getAccountTree(
    binaryPath: string,
    journalFile: string
  ): Promise<string> {
    return this.exec(binaryPath, ['accounts', '--tree'], journalFile);
  }

  async getAvailableYears(
    binaryPath: string,
    journalFile: string
  ): Promise<number[]> {
    try {
      const out = await this.exec(binaryPath, ['stats'], journalFile);
      const match = out.match(/Txns span\s*:\s*(\d{4})-.*to\s*(\d{4})-/);
      if (!match) return [];
      const startYear = parseInt(match[1], 10);
      const endYear = parseInt(match[2], 10);
      const years: number[] = [];
      for (let y = startYear; y <= endYear; y++) years.push(y);
      return years;
    } catch {
      return [];
    }
  }

  async testConnection(binaryPath: string): Promise<string> {
    const env = {
      ...process.env,
      PATH: [
        '/opt/homebrew/bin',
        '/usr/local/bin',
        process.env.PATH,
      ]
        .filter(Boolean)
        .join(':'),
    };
    return new Promise((resolve, reject) => {
      execFile(
        binaryPath,
        ['--version'],
        { env, timeout: 10000 },
        (error, stdout, stderr) => {
          if (error) reject(new Error(stderr?.trim() || error.message));
          else resolve(stdout.trim());
        }
      );
    });
  }
}
