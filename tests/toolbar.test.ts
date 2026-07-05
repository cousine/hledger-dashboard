import { describe, expect, it } from 'vitest';
import { buildCustomPeriod, buildPresetPeriod, getDefaultDateValue } from '../src/ui/toolbar';

describe('buildPresetPeriod', () => {
  it('builds a month period', () => {
    const p = buildPresetPeriod('month', '2024-02-15');
    expect(p.startDate).toBe('2024-02-01');
    expect(p.endDate).toBe('2024-02-29');
    expect(p.preset).toBe('month');
    expect(p.label).toBe('Feb 2024');
    expect(p.hledgerPeriod).toBe('2024-02-01..2024-02-29');
  });

  it('builds a month period for non-leap February', () => {
    const p = buildPresetPeriod('month', '2023-02-15');
    expect(p.endDate).toBe('2023-02-28');
    expect(p.label).toBe('Feb 2023');
  });

  it('builds a month period for 31-day month', () => {
    const p = buildPresetPeriod('month', '2024-01-10');
    expect(p.endDate).toBe('2024-01-31');
    expect(p.label).toBe('Jan 2024');
  });

  it('builds a quarter period', () => {
    const p = buildPresetPeriod('quarter', '2024-05-15');
    expect(p.startDate).toBe('2024-04-01');
    expect(p.endDate).toBe('2024-06-30');
    expect(p.label).toBe('Q2 2024');
  });

  it('builds Q4 quarter correctly', () => {
    const p = buildPresetPeriod('quarter', '2024-11-01');
    expect(p.startDate).toBe('2024-10-01');
    expect(p.endDate).toBe('2024-12-31');
    expect(p.label).toBe('Q4 2024');
  });

  it('builds YTD period', () => {
    const p = buildPresetPeriod('ytd', '2024-06-15');
    expect(p.startDate).toBe('2024-01-01');
    expect(p.endDate).toBe('2024-06-15');
    expect(p.label).toBe('YTD 2024');
  });

  it('defaults to anchor date for unknown preset', () => {
    const p = buildPresetPeriod('custom' as DashboardPeriod, '2024-06-15');
    expect(p.startDate).toBe('2024-06-15');
    expect(p.endDate).toBe('2024-06-15');
    expect(p.label).toBe('Custom');
  });
});

describe('buildCustomPeriod', () => {
  it('creates a custom period', () => {
    const p = buildCustomPeriod('2024-01-01', '2024-12-31');
    expect(p.preset).toBe('custom');
    expect(p.hledgerPeriod).toBe('2024-01-01..2024-12-31');
    expect(p.label).toBe('2024-01-01..2024-12-31');
  });
});

describe('getDefaultDateValue', () => {
  it('returns a date in YYYY-MM-DD format', () => {
    const val = getDefaultDateValue();
    expect(val).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
