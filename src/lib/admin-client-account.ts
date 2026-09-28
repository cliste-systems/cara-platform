export type ClientAccountOption = {
  id: string;
  name: string;
  billing_email: string | null;
  billing_contact_name: string | null;
  billing_address: string | null;
  billing_vat_number: string | null;
  billing_method: string | null;
  storeCount: number;
};

export type ClientAccountSelection =
  | { mode: "existing"; id: string; billingEmail?: string; billingAddress?: string }
  | {
      mode: "new";
      name: string;
      billingEmail: string;
      billingContactName?: string | null;
      billingAddress: string;
      billingVatNumber?: string | null;
    };

/** A customer login belongs to one legal organisation; adding a store never moves it. */
export function clientAccountAccessError(input: {
  accountId: string | null;
  profileAccountId: string | null;
  hasProfile: boolean;
  membershipAccountIds: string[];
  isStaff: boolean;
}): string | null {
  if (input.isStaff) return "Use the client's email address, not a staff admin account.";
  if (
    (input.hasProfile && (!input.accountId || input.profileAccountId !== input.accountId)) ||
    input.membershipAccountIds.some((id) => id !== input.accountId)
  ) {
    return "This email already belongs to another organisation. Select that organisation or use a different client email. Existing accounts cannot be moved during store setup.";
  }
  return null;
}

export function clientSlug(name: string): string {
  return name.toLowerCase().trim().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Legacy retail seeds used these markers without creating a Stripe subscription. */
export function supportsInvoiceClientSetup(input: {
  billingMethod: string | null;
  subscriptionId: string | null;
  storeNiches: (string | null)[];
}): boolean {
  const subscription = input.subscriptionId?.trim();
  const hasSubscription = Boolean(subscription && !["dev_seed_skipped", "kavanaghs_demo_seed"].includes(subscription));
  return !hasSubscription
    && (input.billingMethod === null || input.billingMethod === "manual_invoice")
    && input.storeNiches.every((niche) => niche === "retail");
}
