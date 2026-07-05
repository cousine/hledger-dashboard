import { describe, expect, it } from 'vitest';
import {
  hasMatch,
  hasSelectedDescendant,
  initCollapsed,
  parseTree,
  selectAll,
  type TreeNode,
  uncheckChildren,
} from '../../src/ui/accountTreePicker';

describe('parseTree', () => {
  it('parses flat indented tree', () => {
    const input = `assets
  bank
    checking
  investment`;
    const tree = parseTree(input);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('assets');
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].name).toBe('bank');
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].name).toBe('checking');
  });

  it('computes fullPath by joining with :', () => {
    const input = `assets
  bank
    checking`;
    const tree = parseTree(input);
    expect(tree[0].fullPath).toBe('assets');
    expect(tree[0].children[0].fullPath).toBe('assets:bank');
    expect(tree[0].children[0].children[0].fullPath).toBe('assets:bank:checking');
  });

  it('handles multiple roots', () => {
    const input = `assets
  bank
liabilities
  creditcard`;
    const tree = parseTree(input);
    expect(tree).toHaveLength(2);
    expect(tree[1].name).toBe('liabilities');
  });

  it('skips blank lines', () => {
    const input = `assets
  bank

liabilities`;
    const tree = parseTree(input);
    expect(tree).toHaveLength(2);
  });

  it('returns empty for empty input', () => {
    expect(parseTree('')).toEqual([]);
  });
});

describe('selectAll', () => {
  const tree: TreeNode[] = [
    {
      name: 'assets',
      fullPath: 'assets',
      children: [
        {
          name: 'bank',
          fullPath: 'assets:bank',
          children: [{ name: 'checking', fullPath: 'assets:bank:checking', children: [] }],
        },
      ],
    },
  ];

  it('adds all matching paths to selected set', () => {
    const selected = new Set<string>();
    selectAll(tree, true, '', selected);
    expect(selected.has('assets')).toBe(true);
    expect(selected.has('assets:bank')).toBe(true);
    expect(selected.has('assets:bank:checking')).toBe(true);
  });

  it('removes all matching paths from selected set', () => {
    const selected = new Set(['assets', 'assets:bank', 'assets:bank:checking']);
    selectAll(tree, false, '', selected);
    expect(selected.size).toBe(0);
  });

  it('filters by query', () => {
    const selected = new Set<string>();
    selectAll(tree, true, 'checking', selected);
    expect(selected.has('assets:bank:checking')).toBe(true);
    expect(selected.has('assets')).toBe(false);
  });
});

describe('uncheckChildren', () => {
  it('removes all descendants from selected', () => {
    const nodes: TreeNode[] = [
      {
        name: 'bank',
        fullPath: 'assets:bank',
        children: [{ name: 'checking', fullPath: 'assets:bank:checking', children: [] }],
      },
    ];
    const selected = new Set(['assets:bank', 'assets:bank:checking']);
    uncheckChildren(nodes, selected);
    expect(selected.has('assets:bank')).toBe(false);
    expect(selected.has('assets:bank:checking')).toBe(false);
  });
});

describe('hasSelectedDescendant', () => {
  it('returns true when a child is selected', () => {
    const node: TreeNode = {
      name: 'bank',
      fullPath: 'assets:bank',
      children: [{ name: 'checking', fullPath: 'assets:bank:checking', children: [] }],
    };
    expect(hasSelectedDescendant(node, new Set(['assets:bank:checking']))).toBe(true);
  });

  it('returns false when no child is selected', () => {
    const node: TreeNode = {
      name: 'bank',
      fullPath: 'assets:bank',
      children: [{ name: 'checking', fullPath: 'assets:bank:checking', children: [] }],
    };
    expect(hasSelectedDescendant(node, new Set())).toBe(false);
  });
});

describe('hasMatch', () => {
  it('returns true if query matches any node', () => {
    const nodes: TreeNode[] = [{ name: 'bank', fullPath: 'assets:bank', children: [] }];
    expect(hasMatch(nodes, 'bank')).toBe(true);
    expect(hasMatch(nodes, 'foo')).toBe(false);
  });

  it('returns true if query matches descendant', () => {
    const nodes: TreeNode[] = [
      {
        name: 'assets',
        fullPath: 'assets',
        children: [{ name: 'bank', fullPath: 'assets:bank', children: [] }],
      },
    ];
    expect(hasMatch(nodes, 'bank')).toBe(true);
  });

  it('returns true when query is empty', () => {
    expect(hasMatch([], '')).toBe(true);
  });
});

describe('initCollapsed', () => {
  it('adds nodes with children to collapsed set', () => {
    const nodes: TreeNode[] = [
      {
        name: 'assets',
        fullPath: 'assets',
        children: [
          {
            name: 'bank',
            fullPath: 'assets:bank',
            children: [{ name: 'checking', fullPath: 'assets:bank:checking', children: [] }],
          },
        ],
      },
    ];
    const collapsed = new Set<string>();
    initCollapsed(nodes, collapsed);
    expect(collapsed.has('assets')).toBe(true);
    expect(collapsed.has('assets:bank')).toBe(true);
    expect(collapsed.has('assets:bank:checking')).toBe(false);
  });
});
