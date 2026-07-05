export interface TreeNode {
  name: string;
  fullPath: string;
  children: TreeNode[];
}

export function parseTree(text: string): TreeNode[] {
  const lines = text.trim().split('\n');
  const root: TreeNode[] = [];
  const stack: { node: TreeNode; depth: number }[] = [];

  for (const line of lines) {
    const trimmed = line.trimEnd();
    const content = trimmed.trimStart();
    if (!content) continue;
    const depth = Math.floor((trimmed.length - content.length) / 2);
    const parts = content.split('\n')[0];
    let fullPath = parts;
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop();
    if (stack.length > 0) fullPath = `${stack[stack.length - 1].node.fullPath}:${parts}`;
    const node: TreeNode = { name: parts, fullPath, children: [] };
    if (stack.length > 0) stack[stack.length - 1].node.children.push(node);
    else root.push(node);
    stack.push({ node, depth });
  }
  return root;
}

export function selectAll(
  nodes: TreeNode[],
  checked: boolean,
  query: string,
  selected: Set<string>,
): void {
  for (const n of nodes) {
    const match = !query || n.fullPath.toLowerCase().includes(query.toLowerCase());
    if (match) {
      checked ? selected.add(n.fullPath) : selected.delete(n.fullPath);
    }
    selectAll(n.children, checked, query, selected);
  }
}

export function uncheckChildren(nodes: TreeNode[], selected: Set<string>): void {
  for (const n of nodes) {
    selected.delete(n.fullPath);
    uncheckChildren(n.children, selected);
  }
}

export function hasSelectedDescendant(node: TreeNode, selected: Set<string>): boolean {
  for (const child of node.children) {
    if (selected.has(child.fullPath) || hasSelectedDescendant(child, selected)) return true;
  }
  return false;
}

export function hasMatch(nodes: TreeNode[], query: string): boolean {
  if (!query) return true;
  for (const n of nodes) {
    if (n.fullPath.toLowerCase().includes(query)) return true;
    if (hasMatch(n.children, query)) return true;
  }
  return false;
}

export function initCollapsed(nodes: TreeNode[], collapsed: Set<string>): void {
  for (const n of nodes) {
    if (n.children.length > 0) {
      collapsed.add(n.fullPath);
      initCollapsed(n.children, collapsed);
    }
  }
}

function renderNodes(
  container: HTMLElement,
  nodes: TreeNode[],
  depth: number,
  query: string,
  selected: Set<string>,
  collapsed: Set<string>,
  onChange?: () => void,
  onToggle?: () => void,
): void {
  const sorted = [...nodes].sort((a, b) => {
    const aChecked = selected.has(a.fullPath) || hasSelectedDescendant(a, selected);
    const bChecked = selected.has(b.fullPath) || hasSelectedDescendant(b, selected);
    if (aChecked !== bChecked) return aChecked ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const node of sorted) {
    const match = !query || node.fullPath.toLowerCase().includes(query);
    const childMatch = hasMatch(node.children, query);
    if (query && !match && !childMatch) continue;

    const item = container.createDiv({ cls: 'hldg-dd-item' });
    (item as HTMLElement).style.setProperty('--hldg-depth', String(depth));
    (item as HTMLElement).style.paddingLeft = `${depth * 18 + 4}px`;

    if (node.children.length > 0) {
      const toggle = item.createEl('span', {
        cls: 'hldg-dd-toggle',
        text: collapsed.has(node.fullPath) ? '▶' : '▼',
      });
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (collapsed.has(node.fullPath)) collapsed.delete(node.fullPath);
        else collapsed.add(node.fullPath);
        onToggle?.();
      });
    } else {
      item.createEl('span', { cls: 'hldg-dd-toggle-spacer' });
    }

    const cb = item.createEl('input', { attr: { type: 'checkbox' } });
    const nodeSelected = selected.has(node.fullPath);
    const childSelected = hasSelectedDescendant(node, selected);
    cb.checked = nodeSelected || childSelected;
    cb.addEventListener('change', () => {
      if (cb.checked) {
        selected.add(node.fullPath);
      } else {
        selected.delete(node.fullPath);
        uncheckChildren(node.children, selected);
      }
      onChange?.();
    });

    item.createSpan({ text: node.name });

    if (node.children.length > 0 && !(collapsed.has(node.fullPath) && !query)) {
      renderNodes(
        container,
        node.children,
        depth + 1,
        query,
        selected,
        collapsed,
        onChange,
        onToggle,
      );
    }
  }
}

export function buildAccountTreeContent(
  panel: HTMLElement,
  treeText: string,
  selected: Set<string>,
  onChange?: () => void,
): void {
  const tree = parseTree(treeText);
  const collapsed = new Set<string>();
  initCollapsed(tree, collapsed);
  let searchQuery = '';

  const searchInput = panel.createEl('input', {
    cls: 'hldg-dd-search',
    attr: { type: 'text', placeholder: 'Search accounts...' },
  });

  const btnRow = panel.createDiv({ cls: 'hldg-dd-btn-row' });
  btnRow.createEl('button', { text: 'All', cls: 'hldg-dd-btn' }).addEventListener('click', () => {
    selectAll(tree, true, searchQuery, selected);
    renderTree();
    onChange?.();
  });
  btnRow.createEl('button', { text: 'None', cls: 'hldg-dd-btn' }).addEventListener('click', () => {
    selectAll(tree, false, searchQuery, selected);
    renderTree();
    onChange?.();
  });

  const treeContainer = panel.createDiv({ cls: 'hldg-dd-tree' });

  function handleChange() {
    renderTree();
    onChange?.();
  }

  function handleToggle() {
    renderTree();
  }

  function renderTree() {
    treeContainer.empty();
    renderNodes(
      treeContainer,
      tree,
      0,
      searchQuery,
      selected,
      collapsed,
      handleChange,
      handleToggle,
    );
  }

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderTree();
  });

  renderTree();
}
