// Minimal type declarations for Node builtins used by this plugin.
// These are provided as ambient declarations so that the Obsidian plugin
// linter (@typescript-eslint with type-aware rules) can resolve concrete
// types even when @types/node is not available in its type resolution.
// Without these, process, execFile, and path all resolve to `any`,
// triggering no-unsafe-* rules across client.ts.

declare const process: {
  platform: string;
  env: Record<string, string | undefined>;
};

declare module 'child_process' {
  interface ExecFileOptions {
    cwd?: string;
    env?: Record<string, string | undefined>;
    timeout?: number;
    maxBuffer?: number;
  }
  function execFile(
    file: string,
    args: readonly string[],
    options: ExecFileOptions,
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ): void;
}

declare module 'path' {
  function resolve(...pathSegments: string[]): string;
}
