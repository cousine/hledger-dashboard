import type { FilterShortcut, TabFilterState } from '../hledger/types';

export interface FilterBarCallbacks {
  onOpenAccountPicker: (anchorEl: HTMLElement) => void;
  onRemoveAccountPattern: (pattern: string) => void;
  onOpenCurrencyPicker: (anchorEl: HTMLElement) => void;
  onRemoveCurrency: (currency: string) => void;
  onClearFilters: () => void;
  onApplyShortcut: (shortcut: FilterShortcut) => void;
}

export function chipClass(pattern: string): string {
  if (pattern.startsWith('^income') || pattern.startsWith('income'))
    return 'hldg-filter-chip-income';
  if (pattern.startsWith('^expenses') || pattern.startsWith('expenses'))
    return 'hldg-filter-chip-expenses';
  if (pattern.startsWith('^assets') || pattern.startsWith('assets'))
    return 'hldg-filter-chip-assets';
  if (pattern.startsWith('^liabilities') || pattern.startsWith('liabilities'))
    return 'hldg-filter-chip-liabilities';
  if (pattern.startsWith('^equity') || pattern.startsWith('equity'))
    return 'hldg-filter-chip-equity';
  return 'hldg-filter-chip-default';
}

export function currencyChipClass(currency: string): string {
  if (currency === '$' || currency === 'USD') return 'hldg-filter-chip-currency-usd';
  if (currency === 'EUR') return 'hldg-filter-chip-currency-eur';
  return 'hldg-filter-chip-currency-other';
}

export function renderFilterBar(
  container: HTMLElement,
  filter: TabFilterState,
  shortcuts: FilterShortcut[],
  cb: FilterBarCallbacks,
): void {
  container.empty();
  const bar = container.createDiv({ cls: 'hldg-filter-bar' });

  if (shortcuts.length > 0) {
    const scRow = bar.createDiv({ cls: 'hldg-filter-shortcuts' });
    scRow.createSpan({ cls: 'hldg-filter-label', text: 'Shortcuts:' });
    for (const sc of shortcuts) {
      scRow
        .createEl('button', { cls: 'hldg-filter-shortcut', text: sc.name })
        .addEventListener('click', () => cb.onApplyShortcut(sc));
    }
  }

  const row = bar.createDiv({ cls: 'hldg-filter-row' });

  row.createSpan({ cls: 'hldg-filter-label', text: 'Accounts:' });
  const acctBtn = row.createEl('button', {
    cls: 'hldg-filter-btn',
    text: filter.accountPatterns.length === 0 ? 'All' : `${filter.accountPatterns.length} selected`,
  });
  acctBtn.addEventListener('click', () => cb.onOpenAccountPicker(acctBtn));

  for (const pat of filter.accountPatterns) {
    const chip = row.createSpan({ cls: `hldg-filter-chip ${chipClass(pat)}`, text: pat });
    chip.createSpan({ cls: 'hldg-filter-chip-x', text: ' ✕' }).addEventListener('click', (e) => {
      e.stopPropagation();
      cb.onRemoveAccountPattern(pat);
    });
  }

  row.createSpan({ cls: 'hldg-filter-label', text: 'Currency:' });
  const curBtn = row.createEl('button', {
    cls: 'hldg-filter-btn',
    text: filter.currencies.length === 0 ? 'All' : filter.currencies.join(', '),
  });
  curBtn.addEventListener('click', () => cb.onOpenCurrencyPicker(curBtn));

  for (const c of filter.currencies) {
    const chip = row.createSpan({ cls: `hldg-filter-chip ${currencyChipClass(c)}`, text: c });
    chip.createSpan({ cls: 'hldg-filter-chip-x', text: ' ✕' }).addEventListener('click', (e) => {
      e.stopPropagation();
      cb.onRemoveCurrency(c);
    });
  }

  row
    .createEl('button', { cls: 'hldg-filter-clear', text: 'Clear' })
    .addEventListener('click', () => cb.onClearFilters());
}
