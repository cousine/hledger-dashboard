export interface Column {
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

export type Row = (
  | string
  | { text: string; cls?: string; sortValue?: string | number; onClick?: () => void }
)[];

export function sortRows(rows: Row[], sortCol: number, sortAsc: boolean): Row[] {
  if (sortCol < 0) return rows;
  return [...rows].sort((a, b) => {
    const av = getCellValue(a, sortCol);
    const bv = getCellValue(b, sortCol);
    let cmp: number;
    const an = typeof av === 'number' ? av : parseFloat(String(av).replace(/[^0-9.-]/g, ''));
    const bn = typeof bv === 'number' ? bv : parseFloat(String(bv).replace(/[^0-9.-]/g, ''));
    if (!Number.isNaN(an) && !Number.isNaN(bn)) {
      cmp = an - bn;
    } else {
      cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { sensitivity: 'base' });
    }
    return sortAsc ? cmp : -cmp;
  });
}

export function getPaginationInfo(
  totalItems: number,
  pageSize: number,
  currentPage: number,
): { totalPages: number; currentPage: number; startIdx: number; endIdx: number } {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const clampedPage = Math.min(currentPage, totalPages - 1);
  const startIdx = clampedPage * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalItems);
  return { totalPages, currentPage: clampedPage, startIdx, endIdx };
}

export function getCellValue(row: Row, ci: number): string | number | undefined {
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
  onSortChange?: (col: number) => void,
): HTMLTableElement {
  const table = container.createEl('table', { cls: 'hldg-table' });
  const hasWidth = columns.some((c) => c.width);
  if (hasWidth) table.addClass('hldg-table-fixed');
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

    const sorted = sortRows(rows, sortCol, sortAsc);

    for (const row of sorted) {
      const tr = tbody.createEl('tr');
      for (let ci = 0; ci < row.length; ci++) {
        const cell = row[ci];
        const td = tr.createEl('td');
        if (typeof cell === 'string') {
          td.textContent = cell;
        } else {
          if (cell.onClick || cell.cls) {
            let spanCls = cell.cls || '';
            if (cell.onClick) spanCls += ' hldg-clickable';
            const span = td.createSpan({ text: cell.text, cls: spanCls.trim() || undefined });
            if (cell.onClick) {
              span.addEventListener('click', cell.onClick);
            }
          } else {
            td.textContent = cell.text;
          }
        }
        const colAlign = columns[ci]?.align;
        if (colAlign === 'right') td.addClass('hldg-align-right');
        else if (colAlign === 'center') td.addClass('hldg-align-center');
        const colWidth = columns[ci]?.width;
        if (colWidth) td.style.width = colWidth;
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
              let spanCls = cell.cls || '';
              if (cell.onClick) spanCls += ' hldg-clickable';
              const span = td.createSpan({ text: cell.text, cls: spanCls.trim() || undefined });
              if (cell.onClick) {
                span.addEventListener('click', cell.onClick);
              }
            } else {
              td.textContent = cell.text;
            }
          }
          const cellAlign = columns[ci]?.align;
          if (cellAlign === 'right') td.addClass('hldg-align-right');
          else if (cellAlign === 'center') td.addClass('hldg-align-center');
          const cellWidth = columns[ci]?.width;
          if (cellWidth) td.style.width = cellWidth;
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
      if (col.align === 'right') th.addClass('hldg-align-right');
      else if (col.align === 'center') th.addClass('hldg-align-center');
      if (col.width) th.style.width = col.width;
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
  totalRows?: Row[],
): { setRows: (rows: Row[]) => void; destroy: () => void } {
  const wrapper = container.createDiv();
  let sortCol = -1;
  let sortAsc = true;
  let currentPage = 0;
  let currentRows = rows;

  function render() {
    wrapper.empty();

    const sorted = sortCol >= 0 ? sortRows(currentRows, sortCol, sortAsc) : [...currentRows];

    const pg = getPaginationInfo(sorted.length, pageSize, currentPage);
    currentPage = pg.currentPage;
    const totalPages = pg.totalPages;
    const pageRows = sorted.slice(pg.startIdx, pg.endIdx);

    buildTable(
      wrapper,
      columns,
      pageRows,
      totalRows,
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
      },
    );

    if (totalPages > 1) {
      const nav = wrapper.createDiv({ cls: 'hldg-pagination' });

      const firstBtn = nav.createEl('button', { cls: 'hldg-page-btn', text: '<< first' });
      firstBtn.disabled = currentPage === 0;
      firstBtn.addEventListener('click', () => {
        currentPage = 0;
        render();
      });

      const prevBtn = nav.createEl('button', { cls: 'hldg-page-btn', text: '‹ prev' });
      prevBtn.disabled = currentPage === 0;
      prevBtn.addEventListener('click', () => {
        if (currentPage > 0) {
          currentPage--;
          render();
        }
      });

      nav.createSpan({
        cls: 'hldg-page-info',
        text: `Page ${currentPage + 1} of ${totalPages} (${sorted.length} items)`,
      });

      const nextBtn = nav.createEl('button', { cls: 'hldg-page-btn', text: 'Next ›' });
      nextBtn.disabled = currentPage >= totalPages - 1;
      nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages - 1) {
          currentPage++;
          render();
        }
      });

      const lastBtn = nav.createEl('button', { cls: 'hldg-page-btn', text: 'Last >>' });
      lastBtn.disabled = currentPage >= totalPages - 1;
      lastBtn.addEventListener('click', () => {
        currentPage = totalPages - 1;
        render();
      });
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
