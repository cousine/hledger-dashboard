// biome-ignore lint/style/useNodejsImportProtocol: Obsidian plugin linter doesn't resolve node: protocol types
import { execFile } from 'child_process';
// biome-ignore lint/style/useNodejsImportProtocol: Obsidian plugin linter doesn't resolve node: protocol types
import * as path from 'path';

export class HledgerClient {
  private vaultRoot: string;

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot;
  }

  private buildExecEnv(): Record<string, string | undefined> {
    const isWin = process.platform === 'win32';
    const sep = isWin ? ';' : ':';
    const extraPaths = isWin
      ? []
      : ['/opt/homebrew/bin', '/usr/local/bin', '/opt/homebrew/sbin', '/usr/bin', '/bin'];
    const pathKey = Object.keys(process.env).find((k) => k.toLowerCase() === 'path') || 'PATH';
    return {
      ...process.env,
      LC_ALL: 'C',
      [pathKey]: [...extraPaths, process.env[pathKey]].filter(Boolean).join(sep),
    };
  }

  private async execRaw(binaryPath: string, args: string[], journalFile: string): Promise<string> {
    const journalAbs = path.resolve(this.vaultRoot, journalFile);
    const fullArgs = ['-f', journalAbs, ...args];

    return new Promise((resolve, reject) => {
      execFile(
        binaryPath,
        fullArgs,
        {
          cwd: this.vaultRoot,
          env: this.buildExecEnv(),
          timeout: 30000,
          maxBuffer: 10 * 1024 * 1024,
        },
        (error: Error | null, stdout: string, stderr: string) => {
          if (error) {
            const msg = stderr?.trim() || error.message;
            reject(new Error(msg));
          } else {
            resolve(stdout);
          }
        },
      );
    });
  }

  async exec(binaryPath: string, args: string[], journalFile: string): Promise<string> {
    try {
      return await this.execRaw(binaryPath, args, journalFile);
    } catch (err) {
      if (binaryPath !== 'hledger') throw err;
      const isWin = process.platform === 'win32';
      const fallbacks = isWin ? [] : ['/opt/homebrew/bin/hledger', '/usr/local/bin/hledger'];
      for (const fb of fallbacks) {
        try {
          return await this.execRaw(fb, args, journalFile);
        } catch {
          /* try fallback */
        }
      }
      throw err;
    }
  }

  async getCommodities(binaryPath: string, journalFile: string): Promise<string[]> {
    try {
      const out = await this.exec(binaryPath, ['commodities'], journalFile);
      return out
        .trim()
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  async getAccountTree(binaryPath: string, journalFile: string): Promise<string> {
    return this.exec(binaryPath, ['accounts', '--tree'], journalFile);
  }

  async getAvailableYears(binaryPath: string, journalFile: string): Promise<number[]> {
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
    return new Promise((resolve, reject) => {
      execFile(
        binaryPath,
        ['--version'],
        { env: this.buildExecEnv(), timeout: 10000 },
        (error: Error | null, stdout: string, stderr: string) => {
          if (error) reject(new Error(stderr?.trim() || error.message));
          else resolve(stdout.trim());
        },
      );
    });
  }
}
