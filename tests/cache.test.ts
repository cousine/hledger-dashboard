import { describe, it, expect, vi } from 'vitest';
import { QueryCache } from '../src/cache';

describe('QueryCache', () => {
  it('caches the result of a fetcher', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn().mockResolvedValue('result');

    const r1 = await cache.get('key', fetcher);
    const r2 = await cache.get('key', fetcher);

    expect(r1).toBe('result');
    expect(r2).toBe('result');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent fetches', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn().mockResolvedValue('result');

    const [r1, r2] = await Promise.all([
      cache.get('key', fetcher),
      cache.get('key', fetcher),
    ]);

    expect(r1).toBe('result');
    expect(r2).toBe('result');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('clears cache when period changes', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn().mockResolvedValue('result');

    await cache.get('key', fetcher);
    cache.setPeriod('new-period');
    await cache.get('key', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps cache when period unchanged', async () => {
    const cache = new QueryCache();
    cache.setPeriod('same');

    const fetcher = vi.fn().mockResolvedValue('result');
    await cache.get('key', fetcher);
    cache.setPeriod('same');
    await cache.get('key', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('invalidate clears all entries', async () => {
    const cache = new QueryCache();
    const fetcher = vi.fn().mockResolvedValue('result');

    await cache.get('key', fetcher);
    cache.invalidate();
    await cache.get('key', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('propagates fetcher rejection', async () => {
    const cache = new QueryCache();
    const err = new Error('fetch failed');
    const fetcher = vi.fn().mockRejectedValue(err);

    await expect(cache.get('fail', fetcher)).rejects.toThrow('fetch failed');
  });
});
