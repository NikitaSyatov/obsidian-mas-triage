import { App, Modal, Setting, TFile } from "obsidian";
import { TriageResult } from "../types/triage-result";
import { ObsidianVaultAdapter as VaultAdapter } from "../vault/ObsidianVaultAdapter";
import { MetricsCollector } from "../metrics/MetricsCollector";

export class TriageModal extends Modal {
  constructor(app: App, private files: TFile[], private results: Map<string, TriageResult>, private adapter: VaultAdapter, private metrics: MetricsCollector) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Triage Inbox" });

    const table = contentEl.createEl("table");
    const header = table.createEl("tr");
    ["Note", "Folder", "Tags", "Links", "Confidence", "Actions"].forEach((h) => header.createEl("th", { text: h }));

    for (const file of this.files) {
      const res = this.results.get(file.path);
      if (!res) continue;
      const row = table.createEl("tr");
      row.createEl("td", { text: file.basename });
      row.createEl("td", { text: res.folder });
      row.createEl("td", { text: (res.tags || []).join(", ") });
      row.createEl("td", { text: (res.links || []).join(", ") });
      row.createEl("td", { text: res.confidence.toFixed(2) });

      const actions = row.createEl("td");
      new Setting(actions)
        .addButton((btn) => btn.setButtonText("Accept").onClick(async () => {
          await this.adapter.applyTriage(file, res);
          this.metrics.end({ inputTokens: 0, outputTokens: 0 }, { quality: 1 });
        }))
        .addButton((btn) => btn.setButtonText("Edit").onClick(() => {
          const ta = new (require("obsidian").TextAreaComponent)(actions).setValue(JSON.stringify(res, null, 2));
          new Setting(actions)
            .addButton((b) => b.setButtonText("Save").onClick(async () => {
              try {
                const parsed = JSON.parse(ta.getValue());
                await this.adapter.applyTriage(file, parsed);
                this.metrics.end({ inputTokens: 0, outputTokens: 0 }, { quality: 0.5 });
              } catch (e) {
                // ignore
              }
            }));
        }))
        .addButton((btn) => btn.setButtonText("Reject").onClick(() => {
          this.metrics.end({ inputTokens: 0, outputTokens: 0 }, { quality: 0 });
        }));
    }
  }

  async onClose() {
    await this.metrics.exportToJson("results/latest.json");
  }
}
