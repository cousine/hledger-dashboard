export class QueryCache {
  private cache = new Map<string, Promise<unknown>>();
  private periodKey = '';

  setPeriod(period: string): void {
    if (period !== this.periodKey) {
      this.cache.clear();
      this.periodKey = period;
    }
  }

  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (!this.cache.has(key)) {
      this.cache.set(key, fetcher());
    }
    return this.cache.get(key) as Promise<T>;
  }

  invalidate(): void {
    this.cache.clear();
  }
}
