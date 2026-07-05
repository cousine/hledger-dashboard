export function buildCurrencyContent(
  panel: HTMLElement,
  commodities: string[],
  selected: Set<string>,
  onChange?: () => void,
): void {
  const btnRow = panel.createDiv({ cls: 'hldg-dd-btn-row' });
  const handleChange = () => {
    renderList();
    onChange?.();
  };

  btnRow.createEl('button', { text: 'All', cls: 'hldg-dd-btn' }).addEventListener('click', () => {
    commodities.forEach((c) => {
      selected.add(c);
    });
    handleChange();
  });
  btnRow.createEl('button', { text: 'None', cls: 'hldg-dd-btn' }).addEventListener('click', () => {
    selected.clear();
    handleChange();
  });

  const list = panel.createDiv({ cls: 'hldg-dd-list' });

  function renderList() {
    list.empty();
    for (const c of commodities) {
      const item = list.createDiv({ cls: 'hldg-dd-item' });
      const cb = item.createEl('input', { attr: { type: 'checkbox' } });
      cb.checked = selected.has(c);
      cb.addEventListener('change', () => {
        cb.checked ? selected.add(c) : selected.delete(c);
        handleChange();
      });
      item.createSpan({ text: c });
    }
  }

  renderList();
}
