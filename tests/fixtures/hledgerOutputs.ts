export const BALANCE_JSON_TREE = JSON.stringify([
  [
    [
      'assets',
      '',
      0,
      [
        { acommodity: '$', aquantity: { floatingPoint: 15000 } },
        { acommodity: '€', aquantity: { floatingPoint: 5000 } },
      ],
    ],
    ['assets:bank', '', 1, [{ acommodity: '$', aquantity: { floatingPoint: 15000 } }]],
    ['assets:bank:checking', '', 2, [{ acommodity: '$', aquantity: { floatingPoint: 5000 } }]],
    ['assets:bank:savings', '', 2, [{ acommodity: '$', aquantity: { floatingPoint: 10000 } }]],
    ['liabilities', '', 0, [{ acommodity: '$', aquantity: { floatingPoint: -500 } }]],
    ['liabilities:creditcard', '', 1, [{ acommodity: '$', aquantity: { floatingPoint: -500 } }]],
  ],
]);

export const BALANCE_JSON_EMPTY = '[]';

export const REGISTER_JSON = JSON.stringify([
  [
    '2024-01-01',
    '2024-01-01',
    'Opening balances',
    {
      paccount: 'assets:bank:checking',
      pamount: [{ acommodity: '$', aquantity: { floatingPoint: 5000 } }],
    },
  ],
  [
    '2024-01-01',
    '2024-01-01',
    'Opening balances',
    {
      paccount: 'assets:bank:savings',
      pamount: [{ acommodity: '$', aquantity: { floatingPoint: 10000 } }],
    },
  ],
  [
    '2024-06-15',
    '2024-06-15',
    'Groceries',
    {
      paccount: 'expenses:essentials:groceries',
      pamount: [{ acommodity: '$', aquantity: { floatingPoint: -150 } }],
    },
  ],
  [
    '2024-06-15',
    '2024-06-15',
    'Groceries',
    {
      paccount: 'assets:bank:checking',
      pamount: [{ acommodity: '$', aquantity: { floatingPoint: 150 } }],
    },
  ],
]);

export const REGISTER_JSON_EMPTY = '[]';

export const BUDGET_CSV = `"account","actual","budget"
"expenses:essentials:housing","$1,500.00","$1,500.00"
"expenses:essentials:groceries","$380.00","$400.00"
"expenses:essentials:utilities","$180.00","$200.00"
"expenses:leisure:dining","$320.00","$350.00"
"expenses","$2,380.00","$2,450.00"
`;

export const BUDGET_CSV_EMPTY = `"account","actual"
"expenses:essentials:housing","$1,500.00"
`;

export const MONTHLY_REPORT_JSON = JSON.stringify([
  {
    prDates: [[{ contents: '2024-01-01' }], [{ contents: '2024-02-01' }]],
    prRows: [
      {
        prrName: 'income',
        prrAmounts: [
          [{ acommodity: '$', aquantity: { floatingPoint: 5000 } }],
          [{ acommodity: '$', aquantity: { floatingPoint: 5000 } }],
        ],
      },
      {
        prrName: 'expenses',
        prrAmounts: [
          [{ acommodity: '$', aquantity: { floatingPoint: 2000 } }],
          [{ acommodity: '$', aquantity: { floatingPoint: 2500 } }],
        ],
      },
    ],
  },
]);

export const MONTHLY_BUDGET_REPORT_JSON = JSON.stringify([
  {
    prDates: [[{ contents: '2024-01-01' }], [{ contents: '2024-02-01' }]],
    prRows: [
      {
        prrName: 'income',
        prrAmounts: [
          [{ acommodity: '$', aquantity: { floatingPoint: 5000 } }],
          [{ acommodity: '$', aquantity: { floatingPoint: 5000 } }],
        ],
      },
      {
        prrName: 'expenses',
        prrAmounts: [
          [{ acommodity: '$', aquantity: { floatingPoint: 2000 } }],
          [{ acommodity: '$', aquantity: { floatingPoint: 2500 } }],
        ],
      },
      {
        prrName: 'liabilities',
        prrAmounts: [
          [{ acommodity: '$', aquantity: { floatingPoint: -100 } }],
          [{ acommodity: '$', aquantity: { floatingPoint: -100 } }],
        ],
      },
    ],
  },
]);

export const MONTHLY_ASSETS_JSON = JSON.stringify([
  {
    prDates: [[{ contents: '2024-01-01' }], [{ contents: '2024-02-01' }]],
    prRows: [
      {
        prrName: 'assets:bank:checking',
        prrAmounts: [
          [{ acommodity: '$', aquantity: { floatingPoint: 5000 } }],
          [{ acommodity: '$', aquantity: { floatingPoint: 4500 } }],
        ],
      },
      {
        prrName: 'assets:bank:savings',
        prrAmounts: [
          [{ acommodity: '$', aquantity: { floatingPoint: 10000 } }],
          [{ acommodity: '$', aquantity: { floatingPoint: 10500 } }],
        ],
      },
      {
        prrName: 'assets:investment',
        prrAmounts: [
          [{ acommodity: '€', aquantity: { floatingPoint: 5000 } }],
          [{ acommodity: '€', aquantity: { floatingPoint: 5000 } }],
        ],
      },
    ],
  },
]);

export const MONTHLY_BALANCE_SHEET_JSON = JSON.stringify([
  {
    prDates: [[{ contents: '2024-01-01' }], [{ contents: '2024-02-01' }]],
    prRows: [
      {
        prrName: 'assets:bank',
        prrAmounts: [
          [{ acommodity: '$', aquantity: { floatingPoint: 15000 } }],
          [{ acommodity: '$', aquantity: { floatingPoint: 14000 } }],
        ],
      },
      {
        prrName: 'liabilities:creditcard',
        prrAmounts: [
          [{ acommodity: '$', aquantity: { floatingPoint: -500 } }],
          [{ acommodity: '$', aquantity: { floatingPoint: -700 } }],
        ],
      },
    ],
  },
]);

export const PRINT_TRANSFERS_JSON = JSON.stringify([
  {
    tdate: '2024-03-01',
    tdescription: 'Transfer to savings',
    tpostings: [
      {
        paccount: 'assets:bank:savings',
        pamount: [{ acommodity: '$', aquantity: { floatingPoint: 500 } }],
      },
      {
        paccount: 'assets:bank:checking',
        pamount: [{ acommodity: '$', aquantity: { floatingPoint: -500 } }],
      },
      {
        paccount: 'equity:transfer',
        pamount: [{ acommodity: '$', aquantity: { floatingPoint: 0 } }],
      },
    ],
  },
]);

export const STATS_OUTPUT = `Journal
  Path: /dev/null
  Format: journal
  Transactions: 42
  Postings: 120
  Accounts: 15
  Commodities: 2
Txns span  : 2024-01-01 to 2026-06-30
`;

export const COMMODITIES_OUTPUT = `$
EUR
`;

export const PRICES_OUTPUT = `P 2024-01-01 € $1.10
P 2024-07-01 € $1.12
`;

export const ACCOUNT_TREE_OUTPUT = `assets
  bank
    checking
    savings
  investment
liabilities
  creditcard
equity
  opening-balances
`;

export const BALANCE_FLAT_MULTI_COMMODITY = JSON.stringify([
  [
    [
      'assets:bank:checking',
      '',
      2,
      [
        { acommodity: '$', aquantity: { floatingPoint: 5000 } },
        { acommodity: '€', aquantity: { floatingPoint: 0 } },
      ],
    ],
    ['assets:bank:savings', '', 2, [{ acommodity: '$', aquantity: { floatingPoint: 10000 } }]],
  ],
]);
