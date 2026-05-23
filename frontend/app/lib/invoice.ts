export type InvoiceData = {
  invoice_number: string;
  client_name: string;
  client_email: string;
  amount: number;
  currency: string;
  due_date: string;
  description: string;
  issued_at: string;
};

const STORAGE_KEY = "clearledge:invoice-draft";

export function saveDraft(data: InvoiceData): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadDraft(): InvoiceData | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as InvoiceData;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function generateInvoiceNumber(now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${yyyy}${mm}${dd}-${rand}`;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
