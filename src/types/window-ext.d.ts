// Obsidian augments the global Window interface with DOM creation helpers
// (createDiv, createEl, createSpan, etc.), but these are not declared in
// the obsidian.d.ts type declarations for the Window type itself.
// eslint-plugin-obsidianmd's prefer-create-el rule recommends using
// activeWindow.createDiv() etc. for popout window compatibility, so we
// declare them here to satisfy both the rule and type-checked linting.

declare interface Window {
  createDiv(
    options?: Record<string, unknown> | string,
    callback?: (el: HTMLDivElement) => void,
  ): HTMLDivElement;
}
