export const PALETTE = [
  '#9ece6a',
  '#7dcfff',
  '#73daca',
  '#89ddff',
  '#bb9af7',
  '#f7768e',
  '#e0af68',
  '#ff9e64',
  '#7aa2f7',
  '#2ac3de',
  '#c0caf5',
  '#b4f9f8',
];

export const CONTRAST_PALETTE = [
  '#f7768e',
  '#7aa2f7',
  '#9ece6a',
  '#e0af68',
  '#bb9af7',
  '#73daca',
  '#ff9e64',
];

const formatters: Record<string, Intl.NumberFormat> = {};

function getFormatter(commodity: string): Intl.NumberFormat {
  if (!formatters[commodity]) {
    formatters[commodity] = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return formatters[commodity];
}

export function formatAmount(amount: number, commodity: string): string {
  const fmt = getFormatter(commodity);
  const formatted = fmt.format(Math.abs(amount));
  if (commodity === '$') {
    return `${amount < 0 ? '-' : ''}$${formatted}`;
  }
  return `${amount < 0 ? '-' : ''}${commodity} ${formatted}`;
}

export function formatAmountShort(amount: number, commodity: string): string {
  const abs = Math.abs(amount);
  let formatted: string;
  if (abs >= 1_000_000) {
    formatted = `${(abs / 1_000_000).toFixed(1)}M`;
  } else if (abs >= 1_000) {
    formatted = `${(abs / 1_000).toFixed(0)}K`;
  } else {
    formatted = getFormatter(commodity).format(abs);
  }
  const prefix = amount < 0 ? '-' : '';
  if (commodity === '$') return `${prefix}$${formatted}`;
  return `${prefix}${commodity} ${formatted}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function getColorForAccount(account: string): string {
  const hash = [...account].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}

export function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function cssColor(name: string, fallback: string): string {
  const val = getCSSVar(name);
  return val || fallback;
}
