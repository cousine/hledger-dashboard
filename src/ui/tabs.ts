export interface TabItem {
  id: string;
  label: string;
}

export function renderTabBar(
  container: HTMLElement,
  tabs: TabItem[],
  activeId: string,
  onSwitch: (id: string) => void,
): HTMLElement {
  const bar = container.createDiv({ cls: 'hldg-tab-bar' });
  for (const tab of tabs) {
    const btn = bar.createEl('a', {
      cls: tab.id === activeId ? 'hldg-tab hldg-tab-active' : 'hldg-tab',
      text: tab.label,
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      bar.querySelectorAll('.hldg-tab').forEach((b) => {
        b.removeClass('hldg-tab-active');
      });
      btn.addClass('hldg-tab-active');
      onSwitch(tab.id);
    });
  }
  return bar;
}
