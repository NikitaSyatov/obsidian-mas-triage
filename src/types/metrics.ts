import { QualityMetrics } from "../metrics/quality";

export interface RunMetrics {
  notePath: string;
  engineId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  wallClockMs: number;
  quality: "unknown" | "measured" | number | QualityMetrics;
  timestamp: string;
  runId?: string;
  configHash?: string;
  model?: string;
  seed?: number;
  agentBreakdown?: any[];
  useMessaging?: boolean;
  useSharedMemory?: boolean;
}
