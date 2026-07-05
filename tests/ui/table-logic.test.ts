import { describe, it, expect } from 'vitest';
import { getCellValue, sortRows, getPaginationInfo, Row } from '../../src/ui/table';

describe('getCellValue', () => {
  it('returns sortValue from object cells', () => {
    const row: Row = ['text', { text: 'display', sortValue: 42 }];
    expect(getCellValue(row, 1)).toBe(42);
  });

  it('returns text from object cells without sortValue', () => {
    const row: Row = ['text', { text: 'display' }];
    expect(getCellValue(row, 1)).toBe('display');
  });

  it('returns raw string cells', () => {
    const row: Row = ['hello'];
    expect(getCellValue(row, 0)).toBe('hello');
  });
});

describe('sortRows', () => {
  it('sorts numbers ascending', () => {
    const rows: Row[] = [
      ['a', { text: '30', sortValue: 30 }],
      ['b', { text: '10', sortValue: 10 }],
      ['c', { text: '20', sortValue: 20 }],
    ];
    const sorted = sortRows(rows, 1, true);
    expect(sorted[0][0]).toBe('b');
    expect(sorted[2][0]).toBe('a');
  });

  it('sorts numbers descending', () => {
    const rows: Row[] = [
      ['a', { text: '30', sortValue: 30 }],
      ['b', { text: '10', sortValue: 10 }],
    ];
    const sorted = sortRows(rows, 1, false);
    expect(sorted[0][0]).toBe('a');
  });

  it('sorts strings case-insensitively', () => {
    const rows: Row[] = [
      ['Banana'],
      ['apple'],
      ['Cherry'],
    ];
    const sorted = sortRows(rows, 0, true);
    expect(sorted[0][0]).toBe('apple');
    expect(sorted[1][0]).toBe('Banana');
    expect(sorted[2][0]).toBe('Cherry');
  });

  it('parses numeric strings for numeric comparison', () => {
    const rows: Row[] = [
      ['$1,000'],
      ['$200'],
      ['$50'],
    ];
    const sorted = sortRows(rows, 0, true);
    expect(sorted[0][0]).toBe('$50');
    expect(sorted[2][0]).toBe('$1,000');
  });

  it('returns unsorted when sortCol < 0', () => {
    const rows: Row[] = [['b'], ['a']];
    const sorted = sortRows(rows, -1, true);
    expect(sorted).toBe(rows);
  });
});

describe('getPaginationInfo', () => {
  it('calculates page boundaries', () => {
    const info = getPaginationInfo(25, 10, 0);
    expect(info.totalPages).toBe(3);
    expect(info.currentPage).toBe(0);
    expect(info.startIdx).toBe(0);
    expect(info.endIdx).toBe(10);
  });

  it('clamps currentPage when beyond last page', () => {
    const info = getPaginationInfo(5, 10, 5);
    expect(info.currentPage).toBe(0);
    expect(info.startIdx).toBe(0);
  });

  it('handles empty items', () => {
    const info = getPaginationInfo(0, 10, 0);
    expect(info.totalPages).toBe(1);
  });
});
