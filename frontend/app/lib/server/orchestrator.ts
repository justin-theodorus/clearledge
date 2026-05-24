import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";

const RETRY_DELAY_MS = 5 * 60 * 1000;

function spawnOrchestrator(invoiceId: string, attempt: number) {
  const repoRoot = path.resolve(process.cwd(), "..");
  const python =
    process.env.BACKEND_PYTHON ?? path.join(repoRoot, "backend/.venv/bin/python");
  try {
    // stdio: "inherit" pipes the agent's stdout/stderr straight to the Next
    // dev server's terminal so we can see what the agents are doing.
    const child = spawn(
      python,
      ["-u", "-m", "backend.agents.orchestrator", invoiceId],
      { cwd: repoRoot, stdio: "inherit" },
    );
    child.on("error", (err) =>
      console.error("[orchestrator] spawn error", invoiceId, err),
    );
    child.on("exit", (code, signal) =>
      console.log(
        `[orchestrator] exit invoice=${invoiceId} attempt=${attempt} code=${code} signal=${signal}`,
      ),
    );
    console.log("[orchestrator] dispatched", invoiceId, "attempt", attempt);
  } catch (err) {
    console.error("[orchestrator] dispatch failed", invoiceId, err);
  }
}

export function triggerOrchestrator(
  invoiceId: string,
  options?: { retryOnce?: boolean },
) {
  spawnOrchestrator(invoiceId, 1);
  if (options?.retryOnce) {
    // BANK_TRANSFER: the DBS notification email may arrive after the proof
    // upload. Re-run once so a late email still flips the invoice to PAID.
    // Best-effort; lost if the Next dev server restarts in the interim.
    const timer = setTimeout(() => {
      console.log("[orchestrator] retry-once firing for", invoiceId);
      spawnOrchestrator(invoiceId, 2);
    }, RETRY_DELAY_MS);
    timer.unref?.();
  }
}
