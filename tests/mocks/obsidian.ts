export class App {}
export class TFile {}
export class TFolder {}
export class Modal {
  constructor() {}
  open() {}
  close() {}
}
export class Plugin {
  app: any;
  manifest: any;
  addCommand() {}
  addSettingTab() {}
  loadData() { return Promise.resolve({}); }
  saveData() { return Promise.resolve(); }
}
export class PluginSettingTab {
  constructor() {}
  display() {}
}
export class Setting {
  constructor(app?: any, containerEl?: any) {}
  setName() { return this; }
  setDesc() { return this; }
  addText(cb: any) { if (cb) cb({ setPlaceholder() { return this; }, setValue() { return this; }, onChange() { return this; } }); return this; }
  addDropdown(cb: any) { if (cb) cb({ addOption() { return this; }, setValue() { return this; }, onChange() { return this; } }); return this; }
  addButton(cb: any) { if (cb) cb({ setButtonText() { return this; }, onClick() { return this; } }); return this; }
}
export class Notice {}
export const requestUrl = () => Promise.resolve({});
export class TextAreaComponent {
  constructor() {}
  setValue() { return this; }
  getValue() { return "{}"; }
}
