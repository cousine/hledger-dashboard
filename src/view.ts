import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { QueryCache } from './cache';
import { HledgerClient } from './hledger/client';
import { SAMPLE_JOURNAL } from './hledger/sampleJournal';
import {
  type DashboardContext,
  type DashboardPeriod,
  type DashboardUIState,
  DEFAULT_UI_STATE,
  defaultTabFilter,
  type TabFilterState,
} from './hledger/types';
import type HledgerDashboardPlugin from './main';
import { renderActivity } from './tabs/activity';
import { renderBalanceSheet } from './tabs/balanceSheet';
import { renderBudget } from './tabs/budget';
import { renderTransactions } from './tabs/transactions';
import { renderTransfers } from './tabs/transfers';
import { buildAccountTreeContent } from './ui/accountTreePicker';
import { destroyAllCharts } from './ui/chart';
import { buildCurrencyContent } from './ui/currencyPicker';
import { Dropdown } from './ui/dropdown';
import { type FilterBarCallbacks, renderFilterBar } from './ui/filterBar';
import { renderTabBar, type TabItem } from './ui/tabs';
import { buildPresetPeriod, buildToolbar, getDefaultDateValue } from './ui/toolbar';

export const VIEW_TYPE_HLEDGER_DASHBOARD = 'hledger-dashboard-view';

const TAB_DEFS: TabItem[] = [
  { id: 'balance-sheet', label: 'Balance Sheet' },
  { id: 'activity', label: 'Activity' },
  { id: 'budget', label: 'Budget' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'transfers', label: 'Transfers' },
];

export class HledgerDashboardView extends ItemView {
  private plugin: HledgerDashboardPlugin;
  private client: HledgerClient;
  private cache: QueryCache;
  private tabBarContainer!: HTMLElement;
  private toolbarContainer!: HTMLElement;
  private filterBarContainer!: HTMLElement;
  private contentContainer!: HTMLElement;
  private errorContainer!: HTMLElement;
  private loadingContainer!: HTMLElement;
  private refreshBtn!: HTMLButtonElement;
  private errorEl!: HTMLElement;
  private currentPeriod!: DashboardPeriod;
  private activeTabId = 'balance-sheet';
  private filterState: TabFilterState = defaultTabFilter();
  private commodities: string[] = [];
  private currentDropdown: Dropdown | null = null;
  private availableYears: number[] = [];
  private uiState: DashboardUIState;
  private shellInitialized = false;

  constructor(leaf: WorkspaceLeaf, plugin: HledgerDashboardPlugin) {
    super(leaf);
    this.plugin = plugin;
    const vaultRoot = (
      this.app.vault.adapter as unknown as { getBasePath: () => string }
    ).getBasePath();
    this.client = new HledgerClient(vaultRoot);
    this.cache = new QueryCache();

    const saved = { ...DEFAULT_UI_STATE, ...plugin.settings.uiState };
    this.uiState = saved;
    this.activeTabId = saved.activeTab;

    const today = getDefaultDateValue();
    if (saved.periodPreset && saved.periodPreset !== 'custom') {
      this.currentPeriod = buildPresetPeriod(
        saved.periodPreset as DashboardPeriod['preset'],
        today,
      );
    } else if (saved.periodPreset === 'custom' && saved.periodStartDate && saved.periodEndDate) {
      this.currentPeriod = {
        startDate: saved.periodStartDate,
        endDate: saved.periodEndDate,
        preset: 'custom',
        label: `${saved.periodStartDate} to ${saved.periodEndDate}`,
        hledgerPeriod: `${saved.periodStartDate}..${saved.periodEndDate}`,
      };
    } else {
      this.currentPeriod = buildPresetPeriod(plugin.settings.defaultPeriod, today);
    }

    this.filterState = {
      accountPatterns: saved.filterAccountPatterns,
      currencies: saved.filterCurrencies,
    };
  }

  getViewType(): string {
    return VIEW_TYPE_HLEDGER_DASHBOARD;
  }
  getDisplayText(): string {
    return 'hledger Dashboard';
  }
  getIcon(): string {
    return 'dollar-sign';
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('hldg-view');

    const headerEl = contentEl.createDiv({ cls: 'hldg-header' });
    this.tabBarContainer = headerEl.createDiv();
    this.toolbarContainer = headerEl.createDiv();
    this.filterBarContainer = headerEl.createDiv();
    this.loadingContainer = contentEl.createDiv({ cls: 'hldg-loading' });
    this.errorContainer = contentEl.createDiv();
    this.contentContainer = contentEl.createDiv({ cls: 'hldg-content' });

    await this.refresh();
  }

  private async isConfigured(): Promise<{ ok: boolean; reason?: string }> {
    if (!this.plugin.settings.journalFile) {
      return {
        ok: false,
        reason: 'Journal file not configured. Open Settings to set the path to your .journal file.',
      };
    }
    const exists = await this.app.vault.adapter.exists(this.plugin.settings.journalFile);
    if (!exists) {
      return {
        ok: false,
        reason: `Journal file not found at "${this.plugin.settings.journalFile}". Place the file at your vault root or update the path in Settings.`,
      };
    }
    try {
      await this.client.testConnection(this.plugin.settings.hledgerPath);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: `Could not reach hledger: ${err instanceof Error ? err.message : String(err)}. Ensure hledger is installed and the binary path is correct in Settings.`,
      };
    }
  }

  private renderOnboarding(reason?: string): void {
    this.tabBarContainer.empty();
    this.toolbarContainer.empty();
    this.filterBarContainer.empty();
    this.loadingContainer.hidden = true;
    this.contentContainer.empty();
    this.errorContainer.empty();

    const card = this.contentContainer.createDiv({ cls: 'hldg-onboarding' });
    card.createEl('h2', { text: 'hledger Dashboard' });
    card.createEl('p', { text: 'Configure the plugin to get started:' });

    const steps = card.createEl('ol');
    const step1 = steps.createEl('li');
    step1.createEl('strong', { text: 'Install hledger' });
    step1.createEl('br');
    step1.appendText(
      'Ensure hledger 1.52+ is installed and available (run "hledger --version" to verify).',
    );

    const step2 = steps.createEl('li');
    const btn = step2.createEl('button', { text: 'Open Settings', cls: 'mod-cta' });
    btn.addEventListener('click', () => {
      (this.app as unknown as { setting: { open: () => void } }).setting.open();
    });
    step2.appendText('  Set the journal file path and target currency.');

    const step3 = steps.createEl('li');
    const refreshBtn = step3.createEl('button', { text: 'Refresh', cls: 'mod-cta' });
    refreshBtn.addEventListener('click', () => {
      void this.refresh();
    });
    step3.appendText('  Load your dashboard.');

    card.createEl('hr');
    const sampleSection = card.createDiv({ cls: 'hldg-onboarding-sample' });
    sampleSection.createEl('p', {
      text: 'Just exploring? Load the bundled sample journal to see the dashboard in action.',
    });
    const sampleBtn = sampleSection.createEl('button', {
      text: 'Load sample journal',
      cls: 'mod-cta',
    });
    sampleBtn.addEventListener('click', () => {
      void this.handleLoadSampleJournal(sampleSection);
    });

    if (reason) {
      card.createEl('hr');
      card.createEl('p', { text: `Details: ${reason}`, cls: 'hldg-onboarding-detail' });
    }
  }

  private async fetchCommodities(): Promise<void> {
    try {
      this.commodities = await this.client.getCommodities(
        this.plugin.settings.hledgerPath,
        this.plugin.settings.journalFile,
      );
    } catch {
      this.commodities = [];
    }
  }

  private async fetchAvailableYears(): Promise<void> {
    try {
      this.availableYears = await this.client.getAvailableYears(
        this.plugin.settings.hledgerPath,
        this.plugin.settings.journalFile,
      );
    } catch {
      this.availableYears = [];
    }
  }

  private async handlePeriodChange(p: DashboardPeriod): Promise<void> {
    this.currentPeriod = p;
    this.cache.setPeriod(p.hledgerPeriod);
    this.plugin.saveUIState({
      periodPreset: p.preset,
      periodStartDate: p.startDate,
      periodEndDate: p.endDate,
    });
    await this.renderActiveTab();
  }

  private async handleRefresh(): Promise<void> {
    this.cache.invalidate();
    await this.renderActiveTab();
  }

  private buildToolbar(): void {
    const result = buildToolbar(
      this.toolbarContainer,
      {
        period: this.currentPeriod,
        availableYears: this.availableYears,
        selectedYear: this.uiState.selectedYear,
      },
      {
        onPeriodChange: (p) => {
          void this.handlePeriodChange(p);
        },
        onRefresh: () => {
          void this.handleRefresh();
        },
        onYearChange: (year: string) => {
          this.uiState.selectedYear = year;
          if (!year) {
            const today = getDefaultDateValue();
            this.currentPeriod = buildPresetPeriod(this.plugin.settings.defaultPeriod, today);
          } else {
            this.currentPeriod = {
              startDate: `${year}-01-01`,
              endDate: `${year}-12-31`,
              preset: 'custom',
              label: year,
              hledgerPeriod: `${year}-01-01..${year}-12-31`,
            };
          }
          this.plugin.saveUIState({
            selectedYear: year,
            periodPreset: this.currentPeriod.preset,
            periodStartDate: this.currentPeriod.startDate,
            periodEndDate: this.currentPeriod.endDate,
          });
          void this.renderActiveTab();
        },
      },
    );
    this.refreshBtn = result.refreshBtn;
    this.errorEl = result.errorEl;
  }

  private buildTabBar(): void {
    this.tabBarContainer.empty();
    renderTabBar(this.tabBarContainer, TAB_DEFS, this.activeTabId, (id: string) => {
      this.activeTabId = id;
      this.plugin.saveUIState({ activeTab: id });
      this.buildFilterBar();
      void this.renderActiveTab();
    });
  }

  private buildFilterBar(): void {
    renderFilterBar(
      this.filterBarContainer,
      this.filterState,
      this.plugin.settings.filterShortcuts || [],
      this.getFilterCallbacks(),
    );
  }

  private getFilterCallbacks(): FilterBarCallbacks {
    return {
      onOpenAccountPicker: (anchorEl) => {
        void this.openAccountPicker(anchorEl);
      },
      onRemoveAccountPattern: (pat) => {
        this.filterState.accountPatterns = this.filterState.accountPatterns.filter(
          (p) => p !== pat,
        );
        this.plugin.saveUIState({ filterAccountPatterns: this.filterState.accountPatterns });
        this.buildFilterBar();
        void this.renderActiveTab();
      },
      onOpenCurrencyPicker: (anchorEl) => {
        void this.openCurrencyPicker(anchorEl);
      },
      onRemoveCurrency: (c) => {
        this.filterState.currencies = this.filterState.currencies.filter((x) => x !== c);
        this.plugin.saveUIState({ filterCurrencies: this.filterState.currencies });
        this.buildFilterBar();
        void this.renderActiveTab();
      },
      onClearFilters: () => {
        this.filterState = defaultTabFilter();
        this.plugin.saveUIState({ filterAccountPatterns: [], filterCurrencies: [] });
        this.buildFilterBar();
        void this.renderActiveTab();
      },
      onApplyShortcut: (sc) => {
        this.filterState = {
          accountPatterns: [...sc.accountPatterns],
          currencies: [...sc.currencies],
        };
        this.plugin.saveUIState({
          filterAccountPatterns: this.filterState.accountPatterns,
          filterCurrencies: this.filterState.currencies,
        });
        this.buildFilterBar();
        void this.renderActiveTab();
      },
    };
  }

  private async openAccountPicker(anchorEl: HTMLElement): Promise<void> {
    let treeText = '';
    try {
      treeText = await this.client.getAccountTree(
        this.plugin.settings.hledgerPath,
        this.plugin.settings.journalFile,
      );
    } catch {
      treeText = '';
    }

    const shared = { selected: new Set(this.filterState.accountPatterns) };
    const syncFilter = () => {
      this.filterState.accountPatterns = [...shared.selected];
      this.plugin.saveUIState({ filterAccountPatterns: this.filterState.accountPatterns });
      this.buildFilterBar();
      void this.renderActiveTab();
    };
    const dd = new Dropdown(
      anchorEl,
      (panel, _close) => {
        buildAccountTreeContent(panel, treeText, shared.selected, syncFilter);
      },
      () => {
        this.currentDropdown = null;
      },
    );
    this.currentDropdown = dd;
  }

  private async openCurrencyPicker(anchorEl: HTMLElement): Promise<void> {
    const commodities = this.commodities.length > 0 ? this.commodities : ['$'];
    const shared = { selected: new Set(this.filterState.currencies) };
    const syncFilter = () => {
      this.filterState.currencies = [...shared.selected];
      this.plugin.saveUIState({ filterCurrencies: this.filterState.currencies });
      this.buildFilterBar();
      void this.renderActiveTab();
    };
    new Dropdown(
      anchorEl,
      (panel, _close) => {
        buildCurrencyContent(panel, commodities, shared.selected, syncFilter);
      },
      undefined,
    );
  }

  private async initShell(): Promise<void> {
    this.buildTabBar();
    await this.fetchCommodities();
    await this.fetchAvailableYears();
    this.buildToolbar();
    this.buildFilterBar();
    this.shellInitialized = true;
  }

  async refresh(): Promise<void> {
    const check = await this.isConfigured();
    if (!check.ok) {
      this.shellInitialized = false;
      this.renderOnboarding(check.reason);
      return;
    }
    if (!this.shellInitialized) {
      await this.initShell();
    }
    this.cache.invalidate();
    await this.renderActiveTab();
  }

  private async handleLoadSampleJournal(sampleSection: HTMLElement): Promise<void> {
    try {
      const samplePath = 'sample.journal';
      const existing = this.app.vault.getFileByPath(samplePath);
      if (existing) {
        await this.app.vault.modify(existing, SAMPLE_JOURNAL);
      } else {
        await this.app.vault.create(samplePath, SAMPLE_JOURNAL);
      }
      this.plugin.settings.journalFile = 'sample.journal';
      await this.plugin.saveSettings();
      await this.refresh();
    } catch (err) {
      sampleSection.createEl('p', {
        text: `Could not load sample: ${err instanceof Error ? err.message : String(err)}`,
        cls: 'hldg-onboarding-detail',
      });
    }
  }

  private async renderActiveTab(): Promise<void> {
    destroyAllCharts();
    this.refreshBtn.disabled = true;
    this.refreshBtn.setText('↻ Loading...');
    this.errorEl.textContent = '';
    this.errorContainer.empty();

    const ctx: DashboardContext = {
      settings: this.plugin.settings,
      period: this.currentPeriod,
      vaultRoot: (this.app.vault.adapter as unknown as { getBasePath: () => string }).getBasePath(),
      hledgerPath: this.plugin.settings.hledgerPath,
      commodities: this.commodities,
      targetCurrency: this.plugin.settings.targetCurrency,
      filter: this.filterState,
      uiState: this.uiState,
      onApplyFilter: (patterns) => {
        this.currentDropdown?.close();
        this.filterState.accountPatterns = patterns;
        this.plugin.saveUIState({ filterAccountPatterns: patterns });
        this.buildFilterBar();
        void this.renderActiveTab();
      },
      onNavigate: (tabId, filterPatterns) => {
        if (filterPatterns) {
          this.filterState.accountPatterns = filterPatterns;
          this.plugin.saveUIState({ filterAccountPatterns: filterPatterns });
          this.buildFilterBar();
        }
        this.activeTabId = tabId;
        this.plugin.saveUIState({ activeTab: tabId });
        this.buildTabBar();
        void this.renderActiveTab();
      },
      onUIStateChange: (partial) => {
        Object.assign(this.uiState, partial);
        this.plugin.saveUIState(partial);
      },
    };

    const savedScroll = this.contentContainer.scrollTop;
    try {
      const tempDiv = activeDocument.createElement('div');
      switch (this.activeTabId) {
        case 'balance-sheet':
          await renderBalanceSheet(tempDiv, this.client, ctx);
          break;
        case 'activity':
          await renderActivity(tempDiv, this.client, ctx);
          break;
        case 'budget':
          await renderBudget(tempDiv, this.client, ctx);
          break;
        case 'transactions':
          await renderTransactions(tempDiv, this.client, ctx);
          break;
        case 'transfers':
          await renderTransfers(tempDiv, this.client, ctx);
          break;
      }
      this.contentContainer.empty();
      this.contentContainer.appendChild(tempDiv);
      this.contentContainer.scrollTop = Math.min(savedScroll, this.contentContainer.scrollHeight);
    } catch (err: unknown) {
      this.contentContainer.empty();
      this.errorContainer.createDiv({
        cls: 'hldg-error',
        text: `Failed to render tab:\n${err instanceof Error ? err.message : String(err)}`,
      });
    }

    this.refreshBtn.disabled = false;
    this.refreshBtn.setText('↻ Refresh');
    this.loadingContainer.hidden = true;
  }

  async onClose(): Promise<void> {
    destroyAllCharts();
    this.plugin.saveUIState({
      activeTab: this.activeTabId,
      filterAccountPatterns: this.filterState.accountPatterns,
      filterCurrencies: this.filterState.currencies,
      periodPreset: this.currentPeriod.preset,
      periodStartDate: this.currentPeriod.startDate,
      periodEndDate: this.currentPeriod.endDate,
      selectedYear: this.uiState.selectedYear,
    });
  }
}
