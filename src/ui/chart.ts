import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { TreemapController, TreemapElement } from 'chartjs-chart-treemap';

Chart.register(
  BarController,
  BarElement,
  ArcElement,
  DoughnutController,
  LineController,
  LineElement,
  PointElement,
  Filler,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  TreemapController,
  TreemapElement,
);

const activeCharts = new Map<HTMLElement, Chart>();

export function destroyChart(container: HTMLElement): void {
  const existing = activeCharts.get(container);
  if (existing) {
    existing.destroy();
    activeCharts.delete(container);
  }
}

export function destroyAllCharts(): void {
  for (const [_el, chart] of activeCharts) {
    chart.destroy();
  }
  activeCharts.clear();
}

export function createBarChart(
  container: HTMLElement,
  labels: string[],
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string | string[];
    borderColor?: string | string[];
  }[],
): Chart {
  destroyChart(container);

  const wrapper = container.createDiv({ cls: 'hldg-chart-container' });
  const canvas = wrapper.createEl('canvas');

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map((d) => ({
        label: d.label,
        data: d.data,
        backgroundColor: d.backgroundColor,
        borderColor: d.borderColor || d.backgroundColor,
        borderWidth: 1,
        borderRadius: 4,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: getCSSColor('--text-muted') },
        },
        tooltip: {
          backgroundColor: getCSSColor('--background-secondary'),
          titleColor: getCSSColor('--text-normal'),
          bodyColor: getCSSColor('--text-normal'),
          borderColor: getCSSColor('--background-modifier-border'),
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks: { color: getCSSColor('--text-muted') },
          grid: { color: getCSSColor('--background-modifier-border') },
        },
        y: {
          ticks: { color: getCSSColor('--text-muted') },
          grid: { color: getCSSColor('--background-modifier-border') },
        },
      },
    },
  });

  activeCharts.set(container, chart);
  return chart;
}

export function createDoughnutChart(
  container: HTMLElement,
  labels: string[],
  data: number[],
  backgroundColor: string[],
): Chart {
  destroyChart(container);

  const wrapper = container.createDiv({ cls: 'hldg-chart-container hldg-chart-small' });
  const canvas = wrapper.createEl('canvas');

  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor, borderWidth: 0 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: getCSSColor('--text-muted'), boxWidth: 12, padding: 8 },
        },
        tooltip: {
          backgroundColor: getCSSColor('--background-secondary'),
          titleColor: getCSSColor('--text-normal'),
          bodyColor: getCSSColor('--text-normal'),
          borderColor: getCSSColor('--background-modifier-border'),
          borderWidth: 1,
          callbacks: {
            label(ctx: { label: string; parsed: number; dataset: { data: number[] } }) {
              const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
              return ` ${ctx.label}: ${ctx.parsed.toLocaleString()} (${pct}%)`;
            },
          },
        },
      },
    },
  });

  activeCharts.set(container, chart);
  return chart;
}

export function createLineChart(
  container: HTMLElement,
  labels: string[],
  datasets: {
    label: string;
    data: (number | null)[];
    borderColor: string;
    backgroundColor?: string;
    fill?: boolean;
    borderDash?: number[];
  }[],
): Chart {
  destroyChart(container);

  const wrapper = container.createDiv({ cls: 'hldg-chart-container' });
  const canvas = wrapper.createEl('canvas');

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map((d) => ({
        label: d.label,
        data: d.data,
        borderColor: d.borderColor,
        backgroundColor: d.backgroundColor || `${d.borderColor}33`,
        fill: d.fill ?? false,
        tension: 0.3,
        pointRadius: d.borderDash ? 2 : 4,
        pointHoverRadius: d.borderDash ? 4 : 6,
        borderWidth: d.borderDash ? 1.5 : 2,
        borderDash: d.borderDash,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: getCSSColor('--text-muted') },
        },
        tooltip: {
          backgroundColor: getCSSColor('--background-secondary'),
          titleColor: getCSSColor('--text-normal'),
          bodyColor: getCSSColor('--text-normal'),
          borderColor: getCSSColor('--background-modifier-border'),
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks: { color: getCSSColor('--text-muted') },
          grid: { color: getCSSColor('--background-modifier-border') },
        },
        y: {
          ticks: { color: getCSSColor('--text-muted') },
          grid: { color: getCSSColor('--background-modifier-border') },
        },
      },
    },
  });

  activeCharts.set(container, chart);
  return chart;
}

export function createTreemapChart(
  container: HTMLElement,
  data: { label: string; value: number; backgroundColor: string }[],
): Chart {
  destroyChart(container);

  const wrapper = container.createDiv({ cls: 'hldg-chart-container' });
  const canvas = wrapper.createEl('canvas');

  const chart = new Chart(canvas, {
    type: 'treemap',
    data: {
      datasets: [
        {
          type: 'treemap' as const,
          data: [],
          tree: data,
          key: 'value',
          groups: ['label'],
          labels: {
            display: true,
            formatter(ctx: object) {
              return (ctx as { raw: { label: string } }).raw.label;
            },
            color: '#ffffff',
            font: { size: 11 },
          },
          backgroundColor(ctx: object) {
            return (
              (ctx as { raw: { backgroundColor?: string } }).raw.backgroundColor ||
              'rgba(0,0,0,0.2)'
            );
          },
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.15)',
          spacing: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx: object) {
              const raw = (ctx as { raw: { label: string; value: number } }).raw;
              return `${raw.label}: ${raw.value.toLocaleString()}`;
            },
          },
          backgroundColor: getCSSColor('--background-secondary'),
          titleColor: getCSSColor('--text-normal'),
          bodyColor: getCSSColor('--text-normal'),
        },
      },
    },
  });

  activeCharts.set(container, chart);
  return chart;
}

const CSS_FALLBACKS: Record<string, string> = {
  '--text-normal': '#c0caf5',
  '--text-muted': '#a9b1d6',
  '--background-secondary': '#16161e',
  '--background-modifier-border': '#414868',
};

function getCSSColor(variable: string): string {
  const val = getComputedStyle(document.body).getPropertyValue(variable).trim();
  return val || CSS_FALLBACKS[variable] || '#c0caf5';
}
