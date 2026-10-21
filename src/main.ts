import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { ObsidianVaultAdapter as VaultAdapter } from "./vault/ObsidianVaultAdapter";
import { MetricsCollector } from "./metrics/MetricsCollector";
import { OpenAiLlmClient } from "./llm/LlmClient";
import { StubEngine } from "./engines/StubEngine";
import { SingleAgentEngine } from "./engines/SingleAgentEngine";
import { TriageModal } from "./ui/TriageModal";
import { defaultConfig } from "./config/defaultConfig";

interface MasTriageSettings {
  inboxPath: string;
  engine: "stub" | "single-agent";
  model: string;
  openaiApiKey: string;
}

const DEFAULT_SETTINGS: MasTriageSettings = {
  inboxPath: "00-Inbox",
  engine: "stub",
  model: defaultConfig.model,
  openaiApiKey: "",
};

export default class MasTriagePlugin extends Plugin {
  settings: MasTriageSettings = { ...DEFAULT_SETTINGS };
  adapter!: VaultAdapter;
  metrics!: MetricsCollector;
  llm!: OpenAiLlmClient;
  stubEngine!: StubEngine;
  singleEngine!: SingleAgentEngine;

  async onload() {
    await this.loadSettings();

    this.adapter = new VaultAdapter(this.app, this.settings.inboxPath);
    this.metrics = new MetricsCollector();
    this.llm = new OpenAiLlmClient(this.settings.openaiApiKey, undefined, this.settings.model);
    this.stubEngine = new StubEngine();
    this.singleEngine = new SingleAgentEngine(this.llm, this.metrics, {
      model: this.settings.model,
      maxTokensPerNote: defaultConfig.maxTokensPerNote,
      temperature: defaultConfig.temperature,
    });

    this.addCommand({
      id: "triage-inbox",
      name: "Triage Inbox",
      callback: async () => {
        const files = await this.adapter.listInboxNotes();
        const ctx = await this.adapter.getVaultContext();
        const results = new Map<string, any>();

        const engine: any = this.settings.engine === "single-agent" ? this.singleEngine : this.stubEngine;

        for (const file of files) {
          try {
            const note = await this.adapter.readNote(file);
            const res = await engine.triage(note, ctx);
            results.set(file.path, res);
          } catch (e) {
            // skip on error
          }
        }

        new TriageModal(this.app, files as any, results, this.adapter, this.metrics).open();
      },
    });

    this.addSettingTab(new MasTriageSettingTab(this.app, this));
  }

  onunload() {
    // best effort save
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class MasTriageSettingTab extends PluginSettingTab {
  plugin: MasTriagePlugin;

  constructor(app: App, plugin: MasTriagePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "MAS Triage Settings" });

    new Setting(containerEl)
      .setName("Inbox path")
      .setDesc("Folder with incoming notes")
      .addText((text) =>
        text
          .setPlaceholder("00-Inbox")
          .setValue(this.plugin.settings.inboxPath)
          .onChange(async (value) => {
            this.plugin.settings.inboxPath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Engine")
      .setDesc("stub or single-agent")
      .addDropdown((dd) =>
        dd
          .addOption("stub", "stub")
          .addOption("single-agent", "single-agent")
          .setValue(this.plugin.settings.engine)
          .onChange(async (value) => {
            this.plugin.settings.engine = value as "stub" | "single-agent";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Model")
      .addText((text) =>
        text
          .setPlaceholder("gpt-4o-mini")
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            this.plugin.settings.model = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("OpenAI API Key")
      .addText((text) =>
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiApiKey = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
