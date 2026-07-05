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

    this.addRibbonIcon('dollar-sign', 'Open hledger Dashboard', () => {
      this.activateView();
    });

    this.addCommand({
      id: 'open-hledger-dashboard',
      name: 'Open hledger Dashboard',
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'refresh-hledger-dashboard',
      name: 'Refresh hledger Dashboard',
      callback: () => {
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_HLEDGER_DASHBOARD).first();
        if (leaf?.view instanceof HledgerDashboardView) {
          leaf.view.refresh();
        }
      },
    });

    this.addSettingTab(new HledgerDashboardSettingTab(this.app, this));
  }

  async onunload(): Promise<void> {
    if (this.saveUIStateTimer !== null) {
      clearTimeout(this.saveUIStateTimer);
      await this.saveData(this.settings);
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  saveUIState(partial: Partial<DashboardUIState>): void {
    if (!this.settings.uiState) this.settings.uiState = {} as DashboardUIState;
    Object.assign(this.settings.uiState, partial);
    if (this.saveUIStateTimer !== null) clearTimeout(this.saveUIStateTimer);
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

    workspace.revealLeaf(leaf);
  }
}
