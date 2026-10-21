import { RunMetrics } from "../types/metrics";
import { defaultConfig } from "../config/defaultConfig";
import { computeCost, getPricingFor } from "./cost";

export class MetricsCollector {
  private startTime?: number;
  private notePath?: string;
  private engineId?: string;
  private metrics: RunMetrics[] = [];
  private runMeta: any = {};

  setRunMeta(meta: any) {
    this.runMeta = meta;
  }

  start(notePath: string, engineId: string): void {
    this.notePath = notePath;
    this.engineId = engineId;
    this.startTime = performance.now();
  }

  end(usage: { inputTokens: number; outputTokens: number }, extra?: any): RunMetrics {
    if (this.startTime === undefined) {
      throw new Error("MetricsCollector.end called without start");
    }
    const wallClockMs = performance.now() - this.startTime;
    let costUsd = 0;
    try {
      const pricing = getPricingFor(this.runMeta.model || defaultConfig.model);
      costUsd = computeCost(usage, pricing);
    } catch (e) {
      const priceIn = defaultConfig.prices?.inputPer1M ?? 0.15;
      const priceOut = defaultConfig.prices?.outputPer1M ?? 0.6;
      costUsd = Math.round(((usage.inputTokens * priceIn + usage.outputTokens * priceOut) / 1_000_000) * 1000000) / 1000000;
    }

    const metric: RunMetrics = {
      notePath: this.notePath || "",
      engineId: this.engineId || "",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd,
      wallClockMs,
      quality: extra?.quality === undefined ? "unknown" : (extra.quality as any),
      timestamp: new Date().toISOString(),
      runId: this.runMeta.runId,
      configHash: this.runMeta.configHash,
      model: this.runMeta.model,
      seed: this.runMeta.seed,
      agentBreakdown: extra?.agentBreakdown,
      useMessaging: extra?.useMessaging,
      useSharedMemory: extra?.useSharedMemory,
    } as any;
    this.metrics.push(metric);
    return metric;
  }

  getAll(): RunMetrics[] {
    return [...this.metrics];
  }

  async exportToJson(path: string): Promise<void> {
    const fs = await import("fs/promises");
    await fs.writeFile(path, JSON.stringify(this.metrics, null, 2), "utf-8");
  }
}
