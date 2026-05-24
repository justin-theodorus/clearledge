"use client";

import * as React from "react";
import {
  ScanText,
  ArrowLeftRight,
  Sparkles,
  Workflow,
  FileCheck,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { clsx } from "./ui/primitives";
import { DEFAULT_STAGES, type PipelineStage, type PipelineStatus } from "./pipelineStages";

export type { PipelineStage, PipelineStatus };
export { DEFAULT_STAGES };
export { pipelineFromAudit } from "./pipelineFromAudit";

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  extractor: ScanText,
  fx: ArrowLeftRight,
  matcher: Sparkles,
  orchestrator: Workflow,
  audit: FileCheck,
};

function StatusIcon({ status, fallback: Fallback }: { status: PipelineStatus; fallback: React.ComponentType<{ size?: number }> }) {
  if (status === "done") return <Check size={13} />;
  if (status === "failed") return <X size={13} />;
  if (status === "partial") return <AlertTriangle size={13} />;
  return <Fallback size={13} />;
}

export function Pipeline({
  stages,
  compact = false,
}: {
  stages: PipelineStage[];
  compact?: boolean;
}) {
  return (
    <div className="cl-pipe">
      {stages.map((stage, i) => {
        const Icon = ICONS[stage.id] ?? Sparkles;
        const edgeActive =
          stage.status === "done" &&
          stages[i + 1] &&
          stages[i + 1].status !== "pending";
        return (
          <React.Fragment key={stage.id}>
            <div className={clsx("cl-pipe-node", `is-${stage.status}`)}>
              <div className="cl-pn-icon">
                <StatusIcon status={stage.status} fallback={Icon} />
              </div>
              <div className="cl-pn-meta">
                <span>{stage.name}</span>
                {!compact ? <span>{stage.model}</span> : null}
              </div>
            </div>
            {i < stages.length - 1 ? (
              <div className={clsx("cl-pipe-edge", edgeActive && "is-active")} />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function LivePipeline({
  target,
  runKey,
  compact = false,
  stepMs = 750,
}: {
  target: PipelineStage[];
  runKey: string;
  compact?: boolean;
  stepMs?: number;
}) {
  const [n, setN] = React.useState(0);

  React.useEffect(() => {
    setN(0);
  }, [runKey]);

  React.useEffect(() => {
    if (n >= target.length) return;
    if (target[n].status === "pending") return;
    const t = setTimeout(() => setN((x) => x + 1), stepMs);
    return () => clearTimeout(t);
  }, [n, target, stepMs]);

  const displayed = target.map((stage, i): PipelineStage => {
    if (i < n) return stage;
    if (i === n && stage.status !== "pending") {
      return { ...stage, status: "running" };
    }
    return { ...stage, status: "pending" };
  });

  return <Pipeline stages={displayed} compact={compact} />;
}

export function usePipelineSim({
  msPerStage = 1100,
  autoLoop = false,
}: { msPerStage?: number; autoLoop?: boolean } = {}): PipelineStage[] {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const max = DEFAULT_STAGES.length * 2 + 1;
    const t = setInterval(() => {
      setTick((x) => {
        if (x >= max) return autoLoop ? 0 : max;
        return x + 1;
      });
    }, msPerStage);
    return () => clearInterval(t);
  }, [msPerStage, autoLoop]);

  return DEFAULT_STAGES.map((s, i): PipelineStage => {
    let status: PipelineStatus = "pending";
    if (tick > i * 2 + 1) status = "done";
    else if (tick === i * 2 + 1) status = "running";
    return { ...s, status };
  });
}
