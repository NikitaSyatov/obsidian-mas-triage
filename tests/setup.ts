import { vi } from 'vitest';

vi.mock('obsidian', () => ({
  App: class {},
  TFile: class {},
  TFolder: class {},
  Modal: class {
    constructor() {}
    open() {}
    close() {}
  },
  Plugin: class {
    app: any;
    manifest: any;
    addCommand() {}
    addSettingTab() {}
    loadData() { return Promise.resolve({}); }
    saveData() { return Promise.resolve(); }
  },
  PluginSettingTab: class {
    constructor() {}
    display() {}
  },
  Setting: class {
    constructor(app?: any, containerEl?: any) {}
    setName() { return this; }
    setDesc() { return this; }
    addText(cb: any) { if (cb) cb({ setPlaceholder() { return this; }, setValue() { return this; }, onChange() { return this; } }); return this; }
    addDropdown(cb: any) { if (cb) cb({ addOption() { return this; }, setValue() { return this; }, onChange() { return this; } }); return this; }
    addButton(cb: any) { if (cb) cb({ setButtonText() { return this; }, onClick() { return this; } }); return this; }
  },
  Notice: class {},
  requestUrl: vi.fn(),
  TextAreaComponent: class {
    constructor() {}
    setValue() { return this; }
    getValue() { return "{}"; }
  },
}));

globalThis.fetch = vi.fn(() => {
  throw new Error('LLM call in test — use MockLlmClient');
});
