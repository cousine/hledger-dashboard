import { DashboardPeriod } from '../hledger/types';

export interface ToolbarState {
  period: DashboardPeriod;
  availableYears: number[];
  selectedYear?: string;
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function buildPresetPeriod(
  preset: DashboardPeriod['preset'],
  anchorDate: string // YYYY-MM-DD
): DashboardPeriod {
  const [y, m, d] = anchorDate.split('-').map(Number);
  let startDate: string, endDate: string, label: string;

  switch (preset) {
    case 'month': {
      startDate = `${y}-${pad2(m)}-01`;
      endDate = `${y}-${pad2(m)}-${pad2(lastDayOfMonth(y, m))}`;
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      label = `${months[m - 1]} ${y}`;
      break;
    }
    case 'quarter': {
      const q = Math.ceil(m / 3);
      const qStartMonth = (q - 1) * 3 + 1;
      const qEndMonth = q * 3;
      startDate = `${y}-${pad2(qStartMonth)}-01`;
      endDate = `${y}-${pad2(qEndMonth)}-${pad2(lastDayOfMonth(y, qEndMonth))}`;
      label = `Q${q} ${y}`;
      break;
    }
    case 'ytd': {
      startDate = `${y}-01-01`;
      endDate = `${y}-${pad2(m)}-${pad2(d)}`;
      label = `YTD ${y}`;
      break;
    }
    default: {
      startDate = anchorDate;
      endDate = anchorDate;
      label = 'Custom';
    }
  }

  return {
    startDate,
    endDate,
    preset,
    label,
    hledgerPeriod: `${startDate}..${endDate}`,
  };
}

export function buildCustomPeriod(startDate: string, endDate: string): DashboardPeriod {
  return {
    startDate,
    endDate,
    preset: 'custom',
    label: `${startDate}..${endDate}`,
    hledgerPeriod: `${startDate}..${endDate}`,
  };
}

export function buildToolbar(
  container: HTMLElement,
  state: ToolbarState,
  callbacks: {
    onPeriodChange: (period: DashboardPeriod) => void;
    onRefresh: () => void;
    onYearChange: (year: string) => void;
  }
): { refreshBtn: HTMLButtonElement; errorEl: HTMLElement } {
  const toolbar = container.createDiv({ cls: 'hldg-toolbar' });

  const periodGroup = toolbar.createDiv({ cls: 'hldg-toolbar-period' });

  if (state.availableYears.length > 0) {
    const yearWrap = periodGroup.createDiv({ cls: 'hldg-year-wrap' });
    const yearBtn = yearWrap.createDiv({ cls: 'hldg-year-btn' });
    const selYear = state.selectedYear || '';
    yearBtn.createSpan({ text: selYear || 'All Years' });
    yearBtn.createSpan({ cls: 'hldg-year-arrow', text: '⌄' });
    const yearPanel = yearWrap.createDiv({ cls: 'hldg-year-panel' });
    const allOpt = yearPanel.createDiv({ cls: `hldg-year-opt${!selYear ? ' hldg-year-opt-active' : ''}`, text: 'All Years' });
    allOpt.dataset.year = '';
    for (const y of state.availableYears) {
      const opt = yearPanel.createDiv({ cls: `hldg-year-opt${selYear === String(y) ? ' hldg-year-opt-active' : ''}`, text: String(y) });
      opt.dataset.year = String(y);
    }
    yearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      yearPanel.classList.toggle('hldg-year-panel-open');
    });
    const closePanel = () => yearPanel.classList.remove('hldg-year-panel-open');
    yearPanel.querySelectorAll('.hldg-year-opt').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        yearPanel.querySelectorAll('.hldg-year-opt').forEach(o => o.classList.remove('hldg-year-opt-active'));
        opt.classList.add('hldg-year-opt-active');
        const label = yearBtn.querySelector('span:first-child')!;
        label.textContent = (opt as HTMLElement).dataset.year || 'All Years';
        closePanel();
        const activePill = periodGroup.querySelector('.hldg-pill-active') as HTMLElement;
        if (activePill) positionSlider(activePill);
        callbacks.onYearChange((opt as HTMLElement).dataset.year || '');
      });
    });
    document.addEventListener('click', closePanel);
  }

  const makePresetBtn = (label: string, preset: DashboardPeriod['preset']) => {
    const btn = periodGroup.createEl('a', { cls: 'hldg-pill', text: label });
    if (state.period.preset === preset) btn.addClass('hldg-pill-active');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      periodGroup.querySelectorAll('.hldg-pill').forEach(b => b.removeClass('hldg-pill-active'));
      btn.addClass('hldg-pill-active');
      positionSlider(btn);
      const newPeriod = buildPresetPeriod(preset, getDefaultDateValue());
      startInput.value = newPeriod.startDate;
      endInput.value = newPeriod.endDate;
      callbacks.onPeriodChange(newPeriod);
    });
    return btn;
  };

  makePresetBtn('YTD', 'ytd');
  makePresetBtn('Quarter', 'quarter');
  makePresetBtn('Month', 'month');

  const pillSlider = periodGroup.createDiv({ cls: 'hldg-pill-slider' });
  const positionSlider = (target: HTMLElement) => {
    pillSlider.style.transform = `translateX(${target.offsetLeft}px)`;
    pillSlider.style.width = `${target.offsetWidth}px`;
  };
  const initialActive = periodGroup.querySelector('.hldg-pill-active') as HTMLElement;
  if (initialActive) positionSlider(initialActive);

  const startInput = toolbar.createEl('input', {
    cls: 'hldg-toolbar-date',
    attr: { type: 'date' },
  }) as HTMLInputElement;
  startInput.value = state.period.startDate;

  toolbar.createSpan({ cls: 'hldg-toolbar-date-sep', text: 'to' });

  const endInput = toolbar.createEl('input', {
    cls: 'hldg-toolbar-date',
    attr: { type: 'date' },
  }) as HTMLInputElement;
  endInput.value = state.period.endDate;

  const applyRange = () => {
    periodGroup.querySelectorAll('.hldg-pill').forEach(b => b.removeClass('hldg-pill-active'));
    const newPeriod = buildCustomPeriod(startInput.value, endInput.value);
    callbacks.onPeriodChange(newPeriod);
  };

  startInput.addEventListener('change', applyRange);
  endInput.addEventListener('change', applyRange);

  const refreshBtn = toolbar.createEl('button', { cls: 'hldg-toolbar-refresh', text: '↻ Refresh' });
  refreshBtn.addEventListener('click', () => callbacks.onRefresh());

  const errorEl = toolbar.createDiv({ cls: 'hldg-toolbar-error' });

  return { refreshBtn, errorEl };
}

export function getDefaultDateValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}
