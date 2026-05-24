import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";

export function triggerOrchestrator(invoiceId: string) {
  const repoRoot = path.resolve(process.cwd(), "..");
  const python =
    process.env.BACKEND_PYTHON ?? path.join(repoRoot, "backend/.venv/bin/python");
  try {
    const child = spawn(
      python,
      ["-m", "backend.agents.orchestrator", invoiceId],
      { cwd: repoRoot, detached: true, stdio: "ignore" },
    );
    child.on("error", (err) =>
      console.error("[orchestrator] spawn error", invoiceId, err),
    );
    child.unref();
    console.log("[orchestrator] dispatched", invoiceId);
  } catch (err) {
    console.error("[orchestrator] dispatch failed", invoiceId, err);
  }
}
