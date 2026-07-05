import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/view.ts', 'src/settings.ts', 'src/hledger/sampleJournal.ts',
        'src/tabs/*.ts', 'src/ui/chart.ts', 'src/ui/table.ts', 'src/ui/kpi.ts',
        'src/ui/dropdown.ts', 'src/ui/filterBar.ts', 'src/ui/tabs.ts',
        'src/ui/accountTreePicker.ts', 'src/ui/currencyPicker.ts', 'src/ui/toolbar.ts',
      ],
    },
    globals: true,
  },
});
