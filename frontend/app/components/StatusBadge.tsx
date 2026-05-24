import { Pill, type Tone } from "./ui/primitives";

export type InvoiceStatus =
  | "PENDING"
  | "AWAITING_TRANSFER"
  | "PAID"
  | "RECONCILED"
  | "PARTIAL"
  | "UNVERIFIED"
  | "PROCESSING"
  | "ERROR";

const TONE: Record<InvoiceStatus, Tone> = {
  PENDING: "slate",
  AWAITING_TRANSFER: "sky",
  PAID: "sky",
  RECONCILED: "emerald",
  PARTIAL: "amber",
  UNVERIFIED: "rose",
  PROCESSING: "violet",
  ERROR: "rose",
};

const LABEL: Record<InvoiceStatus, string> = {
  PENDING: "Pending",
  AWAITING_TRANSFER: "Awaiting transfer",
  PAID: "Paid",
  RECONCILED: "Reconciled",
  PARTIAL: "Partial match",
  UNVERIFIED: "Unverified",
  PROCESSING: "Processing",
  ERROR: "Error",
};

export function StatusBadge({ status, large }: { status: InvoiceStatus; large?: boolean }) {
  return (
    <Pill tone={TONE[status] ?? "slate"} large={large} dot={false}>
      {LABEL[status] ?? status}
    </Pill>
  );
}
