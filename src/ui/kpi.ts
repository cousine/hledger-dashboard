export function buildKpiCard(
  container: HTMLElement,
  label: string,
  value: string,
  colorClass: string
): HTMLElement {
  const card = container.createDiv({ cls: 'hldg-kpi-card' });
  card.createDiv({ cls: 'hldg-kpi-label', text: label });
  const valEl = card.createDiv({ cls: `hldg-kpi-value ${colorClass}`, text: value });
  return card;
}

export function buildKpiRow(
  container: HTMLElement
): HTMLElement {
  return container.createDiv({ cls: 'hldg-kpi-row' });
}
