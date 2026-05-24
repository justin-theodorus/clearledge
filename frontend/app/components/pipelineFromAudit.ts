import { DEFAULT_STAGES, type PipelineStage, type PipelineStatus } from "./pipelineStages";

export function pipelineFromAudit(
  audit: { status: string; signals?: Record<string, unknown> | null } | null | undefined,
  hasProof: boolean,
): PipelineStage[] {
  if (!audit) {
    return DEFAULT_STAGES.map((s) => ({ ...s, status: "pending" as PipelineStatus }));
  }
  const final = audit.status;
  const stageStatus: PipelineStatus =
    final === "RECONCILED" ? "done" :
    final === "PARTIAL" ? "partial" :
    final === "UNVERIFIED" ? "failed" :
    final === "ERROR" ? "failed" :
    "pending";
  return DEFAULT_STAGES.map((s, i): PipelineStage => {
    let status: PipelineStatus = "done";
    if (s.id === "extractor" && !hasProof) status = "pending";
    if (s.id === "audit") status = stageStatus;
    if (i > 0 && i < DEFAULT_STAGES.length - 1 && final === "ERROR") status = "failed";
    return { ...s, status };
  });
}
