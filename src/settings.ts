import { type App, PluginSettingTab, Setting, SuggestModal, type TFile } from 'obsidian';
import { HledgerClient } from './hledger/client';
import type HledgerDashboardPlugin from './main';

class JournalFileSuggestModal extends SuggestModal<TFile> {
  private onChoose: (path: string) => void;

  constructor(app: App, onChoose: (path: string) => void) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder('Pick a .journal file...');
  }

  getSuggestions(query: string): TFile[] {
    return this.app.vault
      .getFiles()
      .filter((f) => f.extension === 'journal')
      .filter((f) => f.path.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 50);
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.createEl('div', { text: file.path });
  }

  onChooseSuggestion(file: TFile): void {
    this.onChoose(file.path);
  }
}

export class HledgerDashboardSettingTab extends PluginSettingTab {
  plugin: HledgerDashboardPlugin;
  private closeBtnTimers: number[] = [];

  constructor(app: App, plugin: HledgerDashboardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  hide(): void {
    for (const id of this.closeBtnTimers) clearTimeout(id);
    this.closeBtnTimers = [];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName('hledger Dashboard Settings').setHeading();

    new Setting(containerEl)
      .setName('hledger binary path')
      .setDesc('Path to hledger. Defaults to "hledger" (found via PATH).')
      .addText((text) =>
        text
          .setPlaceholder('hledger')
          .setValue(this.plugin.settings.hledgerPath)
          .onChange(async (val) => {
            this.plugin.settings.hledgerPath = val || 'hledger';
            await this.plugin.saveSettings();
          }),
      )
      .addButton((btn) =>
        btn
          .setButtonText('Test')
          .setCta()
          .onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText('Testing...');
            try {
              const vaultRoot = (
                this.app.vault.adapter as unknown as { getBasePath: () => string }
              ).getBasePath();
              const client = new HledgerClient(vaultRoot);
              const version = await client.testConnection(this.plugin.settings.hledgerPath);
              btn.setButtonText(`✓ ${version}`);
              this.closeBtnTimers.push(
                window.setTimeout(() => {
                  btn.setButtonText('Test');
                  btn.setDisabled(false);
                }, 3000),
              );
            } catch {
              btn.setButtonText('✗ Failed');
              this.closeBtnTimers.push(
                window.setTimeout(() => {
                  btn.setButtonText('Test');
                  btn.setDisabled(false);
                }, 5000),
              );
            }
          }),
      );

    new Setting(containerEl)
      .setName('Journal file')
      .setDesc('Path to your hledger journal file, relative to vault root.')
      .addText((text) =>
        text
          .setPlaceholder('ledger.journal')
          .setValue(this.plugin.settings.journalFile)
          .onChange(async (val) => {
            this.plugin.settings.journalFile = val;
            await this.plugin.saveSettings();
          }),
      )
      .addButton((btn) =>
        btn.setButtonText('Browse').onClick(() => {
          new JournalFileSuggestModal(this.app, (path) => {
            this.plugin.settings.journalFile = path;
            this.plugin.saveSettings();
            this.display();
          }).open();
        }),
      );

    new Setting(containerEl)
      .setName('Target currency')
      .setDesc('Default currency for conversion (e.g. USD, EUR). Used when displaying totals.')
      .addText((text) =>
        text
          .setPlaceholder('USD')
          .setValue(this.plugin.settings.targetCurrency)
          .onChange(async (val) => {
            this.plugin.settings.targetCurrency = val || 'USD';
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Known currencies')
      .setDesc(
        'Comma-separated currency symbols used to distinguish cash accounts from investment/stock accounts in the Balance Sheet.',
      )
      .addText((text) =>
        text
          .setPlaceholder('USD, $, EUR, GBP')
          .setValue(this.plugin.settings.knownCurrencies.join(', '))
          .onChange(async (val) => {
            this.plugin.settings.knownCurrencies = val
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Uncategorized account')
      .setDesc('Account pattern for uncategorized/unclassified transactions.')
      .addText((text) =>
        text
          .setPlaceholder('equity:uncategorized')
          .setValue(this.plugin.settings.uncategorizedAccount)
          .onChange(async (val) => {
            this.plugin.settings.uncategorizedAccount = val;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Page size')
      .setDesc('Number of transactions per page in the Transactions tab.')
      .addText((text) =>
        text
          .setPlaceholder('50')
          .setValue(String(this.plugin.settings.recentTxnCount))
          .onChange(async (val) => {
            const n = parseInt(val, 10);
            if (!Number.isNaN(n) && n > 0) {
              this.plugin.settings.recentTxnCount = n;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName('Default period')
      .setDesc('Default time period when opening the dashboard.')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('month', 'Month')
          .addOption('quarter', 'Quarter')
          .addOption('ytd', 'Year to Date')
          .setValue(this.plugin.settings.defaultPeriod)
          .onChange(async (val) => {
            this.plugin.settings.defaultPeriod = val as 'month' | 'quarter' | 'ytd';
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl).setName('Filter Shortcuts').setHeading();
    containerEl.createEl('p', {
      text: 'Define named filter presets that appear as one-click chips in the filter bar.',
      cls: 'hldg-setting-desc',
    });

    for (let i = 0; i < this.plugin.settings.filterShortcuts.length; i++) {
      const sc = this.plugin.settings.filterShortcuts[i];
      const section = containerEl.createDiv({ cls: 'hldg-shortcut-section' });
      new Setting(section).setName(sc.name || `Shortcut ${i + 1}`).setHeading();

      new Setting(section).setName('Name').addText((text) =>
        text.setValue(sc.name).onChange(async (val) => {
          this.plugin.settings.filterShortcuts[i].name = val;
          await this.plugin.saveSettings();
        }),
      );

      new Setting(section)
        .setName('Account patterns')
        .setDesc('Comma-separated account patterns (e.g. ^assets:bank:, ^liabilities:)')
        .addText((text) =>
          text.setValue(sc.accountPatterns.join(', ')).onChange(async (val) => {
            this.plugin.settings.filterShortcuts[i].accountPatterns = val
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          }),
        );

      new Setting(section)
        .setName('Currencies')
        .setDesc('Comma-separated currency symbols (e.g. USD, EUR)')
        .addText((text) =>
          text.setValue(sc.currencies.join(', ')).onChange(async (val) => {
            this.plugin.settings.filterShortcuts[i].currencies = val
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          }),
        );

      new Setting(section).addButton((btn) =>
        btn.setButtonText('Remove').onClick(async () => {
          this.plugin.settings.filterShortcuts.splice(i, 1);
          await this.plugin.saveSettings();
          this.display();
        }),
      );
    }

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText('Add Shortcut').onClick(async () => {
        this.plugin.settings.filterShortcuts.push({
          id: `sc-${Date.now()}`,
          name: 'New Shortcut',
          accountPatterns: [],
          currencies: [],
        });
        await this.plugin.saveSettings();
        this.display();
      }),
    );
  }
}
