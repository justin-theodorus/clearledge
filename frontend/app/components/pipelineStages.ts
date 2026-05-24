export type PipelineStatus = "pending" | "running" | "done" | "failed" | "partial";

export type PipelineStage = {
  id: string;
  name: string;
  model: string;
  status: PipelineStatus;
};

export const DEFAULT_STAGES: Omit<PipelineStage, "status">[] = [
  { id: "extractor", name: "Extractor", model: "gemma-vision" },
  { id: "fx", name: "FX Resolver", model: "frankfurter" },
  { id: "matcher", name: "Matcher", model: "deepseek" },
  { id: "orchestrator", name: "Orchestrator", model: "claude-sonnet" },
  { id: "audit", name: "Audit", model: "deepseek" },
];
