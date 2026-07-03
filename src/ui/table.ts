export interface Column {
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

export type Row = (string | { text: string; cls?: string; sortValue?: string | number; onClick?: () => void })[];

function getCellValue(row: Row, ci: number): string | number | undefined {
  const cell = row[ci];
  if (typeof cell === 'object' && cell !== null) {
    return cell.sortValue ?? cell.text;
  }
  return cell;
}

export function buildTable(
  container: HTMLElement,
  columns: Column[],
  rows: Row[],
  totalRows?: Row[],
  sortState?: { col: number; asc: boolean },
  onSortChange?: (col: number) => void
): HTMLTableElement {
  const table = container.createEl('table', { cls: 'hldg-table' });
  const hasWidth = columns.some(c => c.width);
  if (hasWidth) table.style.tableLayout = 'fixed';
  const thead = table.createEl('thead');
  const headerRow = thead.createEl('tr');
  const tbody = table.createEl('tbody');

  // internal sort state (used when onSortChange is not provided)
  let internalSortCol = -1;
  let internalSortAsc = true;

  function renderBody() {
    tbody.empty();

    const sortCol = onSortChange ? (sortState?.col ?? -1) : internalSortCol;
    const sortAsc = onSortChange ? (sortState?.asc ?? true) : internalSortAsc;

    const sorted = sortCol < 0 ? rows : [...rows].sort((a, b) => {
      const av = getCellValue(a, sortCol);
      const bv = getCellValue(b, sortCol);
      let cmp: number;
      const an = typeof av === 'number' ? av : parseFloat(String(av));
      const bn = typeof bv === 'number' ? bv : parseFloat(String(bv));
      if (!isNaN(an) && !isNaN(bn)) {
        cmp = an - bn;
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { sensitivity: 'base' });
      }
      return sortAsc ? cmp : -cmp;
    });

    for (const row of sorted) {
      const tr = tbody.createEl('tr');
      for (let ci = 0; ci < row.length; ci++) {
        const cell = row[ci];
        const td = tr.createEl('td');
        if (typeof cell === 'string') {
          td.textContent = cell;
        } else {
          if (cell.onClick || cell.cls) {
            const span = td.createSpan({ text: cell.text, cls: cell.cls });
            if (cell.onClick) {
              span.style.cursor = 'pointer';
              span.addEventListener('click', cell.onClick);
            }
          } else {
            td.textContent = cell.text;
          }
        }
        if (columns[ci]?.align === 'right') td.style.textAlign = 'right';
        else if (columns[ci]?.align === 'center') td.style.textAlign = 'center';
        if (columns[ci]?.width) td.style.width = columns[ci].width!;
      }
    }

    if (totalRows) {
      for (const row of totalRows) {
        const tr = tbody.createEl('tr', { cls: 'hldg-total-row' });
        for (let ci = 0; ci < row.length; ci++) {
          const cell = row[ci];
          const td = tr.createEl('td');
          if (typeof cell === 'string') {
            td.textContent = cell;
          } else {
            if (cell.onClick || cell.cls) {
              const span = td.createSpan({ text: cell.text, cls: cell.cls });
              if (cell.onClick) {
                span.style.cursor = 'pointer';
                span.addEventListener('click', cell.onClick);
              }
            } else {
              td.textContent = cell.text;
            }
          }
          if (columns[ci]?.align === 'right') td.style.textAlign = 'right';
          else if (columns[ci]?.align === 'center') td.style.textAlign = 'center';
          if (columns[ci]?.width) td.style.width = columns[ci].width!;
        }
      }
    }
  }

  function updateHeaders() {
    headerRow.empty();
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci];
      let label = col.label;
      if (onSortChange && sortState && ci === sortState.col) {
        label += sortState.asc ? ' ↑' : ' ↓';
      } else if (!onSortChange && ci === internalSortCol) {
        label += internalSortAsc ? ' ↑' : ' ↓';
      }
      const th = headerRow.createEl('th', { text: label });
      if (col.align === 'right') th.style.textAlign = 'right';
      else if (col.align === 'center') th.style.textAlign = 'center';
      if (col.width) th.style.width = col.width;
      th.style.cursor = 'pointer';
      th.style.userSelect = 'none';
      th.addEventListener('click', () => {
        if (onSortChange) {
          onSortChange(ci);
        } else {
          if (internalSortCol === ci) {
            internalSortAsc = !internalSortAsc;
          } else {
            internalSortCol = ci;
            internalSortAsc = true;
          }
          renderBody();
          updateHeaders();
        }
      });
    }
  }

  updateHeaders();
  renderBody();

  return table;
}

export function createPaginatedTable(
  container: HTMLElement,
  columns: Column[],
  rows: Row[],
  pageSize: number,
  totalRows?: Row[]
): { setRows: (rows: Row[]) => void; destroy: () => void } {
  const wrapper = container.createDiv();
  let sortCol = -1;
  let sortAsc = true;
  let currentPage = 0;
  let currentRows = rows;

  function render() {
    wrapper.empty();

    const sorted = [...currentRows];
    if (sortCol >= 0) {
      sorted.sort((a, b) => {
        const av = getCellValue(a, sortCol);
        const bv = getCellValue(b, sortCol);
        let cmp: number;
        const an = typeof av === 'number' ? av : parseFloat(String(av));
        const bn = typeof bv === 'number' ? bv : parseFloat(String(bv));
        if (!isNaN(an) && !isNaN(bn)) {
          cmp = an - bn;
        } else {
          cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { sensitivity: 'base' });
        }
        return sortAsc ? cmp : -cmp;
      });
    }

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    if (currentPage >= totalPages) currentPage = totalPages - 1;

    const startIdx = currentPage * pageSize;
    const pageRows = sorted.slice(startIdx, startIdx + pageSize);

    buildTable(wrapper, columns, pageRows, totalRows,
      { col: sortCol, asc: sortAsc },
      (col: number) => {
        if (sortCol === col) {
          sortAsc = !sortAsc;
        } else {
          sortCol = col;
          sortAsc = true;
        }
        currentPage = 0;
        render();
      }
    );

    if (totalPages > 1) {
      const nav = wrapper.createDiv({ cls: 'hldg-pagination' });

      const firstBtn = nav.createEl('button', { cls: 'hldg-page-btn', text: '<< First' });
      firstBtn.disabled = currentPage === 0;
      firstBtn.addEventListener('click', () => { currentPage = 0; render(); });

      const prevBtn = nav.createEl('button', { cls: 'hldg-page-btn', text: '‹ Prev' });
      prevBtn.disabled = currentPage === 0;
      prevBtn.addEventListener('click', () => { if (currentPage > 0) { currentPage--; render(); } });

      nav.createSpan({
        cls: 'hldg-page-info',
        text: `Page ${currentPage + 1} of ${totalPages} (${sorted.length} items)`,
      });

      const nextBtn = nav.createEl('button', { cls: 'hldg-page-btn', text: 'Next ›' });
      nextBtn.disabled = currentPage >= totalPages - 1;
      nextBtn.addEventListener('click', () => { if (currentPage < totalPages - 1) { currentPage++; render(); } });

      const lastBtn = nav.createEl('button', { cls: 'hldg-page-btn', text: 'Last >>' });
      lastBtn.disabled = currentPage >= totalPages - 1;
      lastBtn.addEventListener('click', () => { currentPage = totalPages - 1; render(); });
    }
  }

  render();

  return {
    setRows(newRows: Row[]) {
      currentRows = newRows;
      currentPage = 0;
      sortCol = -1;
      sortAsc = true;
      render();
    },
    destroy() {
      wrapper.remove();
    },
  };
}
