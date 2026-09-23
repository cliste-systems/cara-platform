export type PlatformBillingCycle = "monthly" | "annual" | "usage";
export type PlatformCostSource = "manual" | "api";
export type PlatformApiProvider = "openrouter";

export type PlatformVendorCostRow = {
  id: string;
  vendor_key: string;
  display_name: string;
  amount_cents: number | null;
  currency: string;
  billing_cycle: PlatformBillingCycle;
  billing_day: number | null;
  next_billing_date: string | null;
  source: PlatformCostSource;
  api_provider: PlatformApiProvider | null;
  last_synced_at: string | null;
  last_synced_amount_cents: number | null;
  last_sync_error: string | null;
  dashboard_url: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformSpendSummary = {
  monthlyRunRateCents: number;
  dueThisMonthCents: number;
  apiSyncedMtdCents: number;
  totalEstimatedMonthlyCents: number;
};

const MS_PER_DAY = 86_400_000;

export function platformSpendUsdToEurRate(): number {
  const raw = process.env.PLATFORM_SPEND_USD_TO_EUR?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const voice = process.env.VOICE_COST_USD_TO_EUR?.trim();
  if (voice) {
    const parsed = Number(voice);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0.92;
}

export function usdToEurCents(usd: number): number {
  return Math.round(usd * platformSpendUsdToEurRate() * 100);
}

export function formatPlatformSpendEur(cents: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function parseIsoDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function computeNextBillingDate(
  billingDay: number | null,
  fromDate: Date = new Date(),
): string | null {
  if (!billingDay || billingDay < 1 || billingDay > 28) return null;

  const year = fromDate.getUTCFullYear();
  const month = fromDate.getUTCMonth();
  const day = fromDate.getUTCDate();

  let candidate = new Date(Date.UTC(year, month, billingDay));
  if (day >= billingDay) {
    candidate = new Date(Date.UTC(year, month + 1, billingDay));
  }
  return formatIsoDate(candidate);
}

export function effectiveAmountCents(row: PlatformVendorCostRow): number | null {
  if (row.billing_cycle === "usage") {
    return row.last_synced_amount_cents ?? row.amount_cents;
  }
  return row.amount_cents;
}

export function normalizeToMonthlyCents(row: PlatformVendorCostRow): number {
  const amount = effectiveAmountCents(row);
  if (amount == null || amount <= 0) return 0;
  if (row.billing_cycle === "annual") return Math.round(amount / 12);
  return amount;
}

export function isSameCalendarMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

export function sumDueThisMonth(
  rows: PlatformVendorCostRow[],
  reference: Date = new Date(),
): number {
  let total = 0;
  for (const row of rows) {
    if (!row.active || !row.next_billing_date) continue;
    const due = parseIsoDate(row.next_billing_date);
    if (!isSameCalendarMonth(due, reference)) continue;
    const amount = effectiveAmountCents(row);
    if (amount != null && amount > 0) total += amount;
  }
  return total;
}

export function sumMonthlyRunRate(rows: PlatformVendorCostRow[]): number {
  return rows
    .filter((row) => row.active)
    .reduce((sum, row) => sum + normalizeToMonthlyCents(row), 0);
}

export function sumApiSyncedMtd(rows: PlatformVendorCostRow[]): number {
  return rows
    .filter((row) => row.active && row.source === "api")
    .reduce((sum, row) => sum + (row.last_synced_amount_cents ?? 0), 0);
}

export function buildPlatformSpendSummary(
  rows: PlatformVendorCostRow[],
  reference: Date = new Date(),
): PlatformSpendSummary {
  const active = rows.filter((row) => row.active);
  const monthlyRunRateCents = sumMonthlyRunRate(active);
  const dueThisMonthCents = sumDueThisMonth(active, reference);
  const apiSyncedMtdCents = sumApiSyncedMtd(active);

  const usageApiMonthly = active
    .filter((row) => row.billing_cycle === "usage" && row.source === "api")
    .reduce((sum, row) => sum + (row.last_synced_amount_cents ?? 0), 0);

  const fixedMonthly = active
    .filter((row) => row.billing_cycle !== "usage")
    .reduce((sum, row) => sum + normalizeToMonthlyCents(row), 0);

  return {
    monthlyRunRateCents,
    dueThisMonthCents,
    apiSyncedMtdCents,
    totalEstimatedMonthlyCents: fixedMonthly + usageApiMonthly,
  };
}

export type BillingDueStatus = "overdue" | "due_soon" | "ok" | null;

export function billingDueStatus(
  nextBillingDate: string | null,
  reference: Date = new Date(),
): BillingDueStatus {
  if (!nextBillingDate) return null;
  const due = parseIsoDate(nextBillingDate);
  const today = Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate(),
  );
  const dueMs = due.getTime();
  if (dueMs < today) return "overdue";
  if (dueMs - today <= 7 * MS_PER_DAY) return "due_soon";
  return "ok";
}

export function billingCycleLabel(cycle: PlatformBillingCycle): string {
  switch (cycle) {
    case "monthly":
      return "Monthly";
    case "annual":
      return "Annual";
    case "usage":
      return "Usage-based";
  }
}

export function applyComputedNextBillingDates(
  rows: PlatformVendorCostRow[],
): PlatformVendorCostRow[] {
  return rows.map((row) => {
    if (row.billing_cycle === "usage" || row.next_billing_date) return row;
    const next = computeNextBillingDate(row.billing_day);
    return next ? { ...row, next_billing_date: next } : row;
  });
}
