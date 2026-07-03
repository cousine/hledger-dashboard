export class Dropdown {
  private backdrop: HTMLElement;
  private panel: HTMLElement;
  private _closed = false;
  private onClose?: () => void;

  constructor(
    anchorEl: HTMLElement,
    contentBuilder: (panel: HTMLElement, close: () => void) => void,
    onClose?: () => void
  ) {
    this.onClose = onClose;
    this.backdrop = document.body.createDiv({ cls: 'hldg-dropdown-backdrop' });
    this.panel = this.backdrop.createDiv({ cls: 'hldg-dropdown-panel' });

    const rect = anchorEl.getBoundingClientRect();
    this.panel.style.top = `${rect.bottom + 4}px`;
    this.panel.style.left = `${Math.min(rect.left, window.innerWidth - 320)}px`;
    this.panel.style.minWidth = `${Math.max(rect.width, 240)}px`;

    this.backdrop.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this.backdrop) this.close();
    });

    const closeFn = () => this.close();

    contentBuilder(this.panel, closeFn);

    this.backdrop.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close();
    });

    document.body.appendChild(this.backdrop);
    this.panel.focus();
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    this.backdrop.remove();
    if (this.onClose) this.onClose();
  }

  get closed(): boolean { return this._closed; }
}
