import { DEFAULT_STAGES, type PipelineStage, type PipelineStatus } from "./pipelineStages";

export function pipelineFromAudit(
  audit: { status: string; signals?: Record<string, unknown> | null } | null | undefined,
  hasProof: boolean,
  hasTxn: boolean = false,
): PipelineStage[] {
  if (audit) {
    const final = audit.status;
    const finalStatus: PipelineStatus =
      final === "RECONCILED" ? "done" :
      final === "PARTIAL" ? "partial" :
      final === "UNVERIFIED" ? "failed" :
      final === "ERROR" ? "failed" :
      "pending";
    return DEFAULT_STAGES.map((s, i): PipelineStage => {
      let status: PipelineStatus = "done";
      if (s.id === "extractor" && !hasProof) status = "pending";
      if (s.id === "audit") status = finalStatus;
      if (i > 0 && i < DEFAULT_STAGES.length - 1 && final === "ERROR") status = "failed";
      return { ...s, status };
    });
  }

  // No audit yet — derive a smooth running target from upstream signals so the
  // LivePipeline can cascade through stages stage-by-stage.
  if (hasProof) {
    // Proof has arrived; the agent pipeline is running. Mark the terminal
    // Audit stage as `running` so LivePipeline animates earlier stages to
    // `done` then settles on Audit pulsing until the audit_log row appears.
    return DEFAULT_STAGES.map((s): PipelineStage => {
      if (s.id === "audit") return { ...s, status: "running" };
      return { ...s, status: "done" };
    });
  }

  // hasTxn without proof, or fully idle: pipeline cannot start until proof
  // arrives, so leave every node pending. The header summary explains why.
  void hasTxn;
  return DEFAULT_STAGES.map((s) => ({ ...s, status: "pending" as PipelineStatus }));
}
