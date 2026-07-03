export interface TabFilterState {
  accountPatterns: string[];
  currencies: string[];
}

export function defaultTabFilter(): TabFilterState {
  return { accountPatterns: [], currencies: [] };
}

export interface FilterShortcut {
  id: string;
  name: string;
  accountPatterns: string[];
  currencies: string[];
}

export interface DashboardPeriod {
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  preset: 'month' | 'quarter' | 'ytd' | 'custom';
  label: string;
  hledgerPeriod: string;  // "startDate..endDate"
}

export interface BalanceEntry {
  account: string;
  amount: number;
  commodity: string;
  depth?: number;
  isBudget?: boolean;
  budgetAmount?: number;
}

export interface RegisterEntry {
  date: string;
  description: string;
  account: string;
  amount: number;
  commodity: string;
}

export interface DashboardUIState {
  activeTab: string;
  periodPreset: string;
  periodStartDate: string;
  periodEndDate: string;
  selectedYear: string;
  filterAccountPatterns: string[];
  filterCurrencies: string[];
  balanceSheetMode: 'summary' | 'detail';
  expenseMode: 'groups' | 'atomic';
  txnTypeFilter: 'all' | 'credit' | 'debit';
  breakdownDepth: 2 | 3;
  directionFilter: 'all' | 'out' | 'in';
}

export const DEFAULT_UI_STATE: DashboardUIState = {
  activeTab: 'balance-sheet',
  periodPreset: 'ytd',
  periodStartDate: '',
  periodEndDate: '',
  selectedYear: '',
  filterAccountPatterns: [],
  filterCurrencies: [],
  balanceSheetMode: 'detail',
  expenseMode: 'atomic',
  txnTypeFilter: 'all',
  breakdownDepth: 2,
  directionFilter: 'all',
};

export interface DashboardContext {
  settings: HledgerDashboardSettings;
  period: DashboardPeriod;
  vaultRoot: string;
  hledgerPath: string;
  commodities: string[];
  targetCurrency: string;
  filter: TabFilterState;
  uiState: DashboardUIState;
  onApplyFilter?: (patterns: string[]) => void;
  onNavigate?: (tabId: string, filterPatterns?: string[]) => void;
  onUIStateChange?: (partial: Partial<DashboardUIState>) => void;
}

export interface HledgerDashboardSettings {
  hledgerPath: string;
  journalFile: string;
  recentTxnCount: number;
  defaultPeriod: 'month' | 'quarter' | 'ytd';
  targetCurrency: string;
  uncategorizedAccount: string;
  filterShortcuts: FilterShortcut[];
  uiState?: DashboardUIState;
}

export const DEFAULT_SETTINGS: HledgerDashboardSettings = {
  hledgerPath: 'hledger',
  journalFile: 'finances/finances.journal',
  recentTxnCount: 20,
  defaultPeriod: 'month',
  targetCurrency: 'EGP',
  uncategorizedAccount: 'equity:uncategorized',
  filterShortcuts: [],
};
