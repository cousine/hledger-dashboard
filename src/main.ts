import { Plugin } from 'obsidian';
import {
  type DashboardUIState,
  DEFAULT_SETTINGS,
  type HledgerDashboardSettings,
} from './hledger/types';
import { HledgerDashboardSettingTab } from './settings';
import { HledgerDashboardView, VIEW_TYPE_HLEDGER_DASHBOARD } from './view';

export default class HledgerDashboardPlugin extends Plugin {
  settings!: HledgerDashboardSettings;
  private saveUIStateTimer: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_HLEDGER_DASHBOARD, (leaf) => new HledgerDashboardView(leaf, this));

    this.addRibbonIcon('dollar-sign', 'Open hledger dashboard', () => {
      void this.activateView();
    });

    this.addCommand({
      id: 'open',
      name: 'Open dashboard',
      callback: () => {
        void this.activateView();
      },
    });

    this.addCommand({
      id: 'refresh',
      name: 'Refresh dashboard',
      callback: () => {
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_HLEDGER_DASHBOARD).first();
        if (leaf?.view instanceof HledgerDashboardView) {
          void leaf.view.refresh();
        }
      },
    });

    this.addSettingTab(new HledgerDashboardSettingTab(this.app, this));
  }

  onunload(): void {
    if (this.saveUIStateTimer !== null) {
      window.clearTimeout(this.saveUIStateTimer);
      void this.saveData(this.settings);
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<HledgerDashboardSettings>,
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  saveUIState(partial: Partial<DashboardUIState>): void {
    if (!this.settings.uiState) this.settings.uiState = {} as DashboardUIState;
    Object.assign(this.settings.uiState, partial);
    if (this.saveUIStateTimer !== null) window.clearTimeout(this.saveUIStateTimer);
    this.saveUIStateTimer = window.setTimeout(() => {
      this.saveUIStateTimer = null;
      void this.saveData(this.settings);
    }, 1000);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_HLEDGER_DASHBOARD).first();
    if (!leaf) {
      leaf = workspace.getLeaf(true);
      await leaf.setViewState({
        type: VIEW_TYPE_HLEDGER_DASHBOARD,
        active: true,
      });
    }

    void workspace.revealLeaf(leaf);
  }
}
