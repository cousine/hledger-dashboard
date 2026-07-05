Object.defineProperty(globalThis, 'activeDocument', {
  get: () => document,
  configurable: true,
});
