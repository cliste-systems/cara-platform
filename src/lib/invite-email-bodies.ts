import { CLISTE_COMPANY, PRODUCT_NAME } from "@/lib/company-details";

export function inviteEmailLogoUrl(origin: string, logoPath: string): string {
  return `${origin}${logoPath}`;
}

export type BuildInviteEmailBodiesInput = {
  actionLink: string;
  recipientName?: string;
  businessName: string;
  productName: string;
  logoUrl: string;
  organizationName?: string;
  billingMethod?: "invoice" | "manual_invoice" | "card";
  requiresPassword?: boolean;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function buildInviteEmailBodies(input: BuildInviteEmailBodiesInput): { subject: string; text: string; html: string } {
  const name = input.recipientName?.trim() || "";
  const business = input.businessName.trim() || "your store";
  const organization = input.organizationName?.trim() || business;
  const requiresPassword = input.requiresPassword !== false;
  const subject = `${PRODUCT_NAME} · ${requiresPassword ? "Set up your account" : "Your store invitation"} for ${business}`;
  const greeting = name ? `Hi ${name},` : "Hello,";
  const steps = requiresPassword
    ? ["Choose your password", "Review and accept your organisation’s agreements", "Open your store dashboard"]
    : ["Sign in securely", "Review any outstanding organisation agreements", "Open your store dashboard"];
  const billing = (input.billingMethod === "invoice" || input.billingMethod === "manual_invoice")
    ? "We’ll send invoices to your organisation’s billing contact under your agreed payment terms. No card details are needed to set up your account."
    : "Your HelloCara team will help you with your account and next steps.";
  const cta = requiresPassword ? "Set up my account" : "Open my invitation";
  const text = [greeting, "", `Your HelloCara team has prepared access to ${business}.`, `Organisation: ${organization}`, "", ...steps.map((step, index) => `${index + 1}. ${step}`), "", `${cta}:`, input.actionLink, "", billing, "", "This is a personal, single-use invitation. If the link has expired, reply to this email and we’ll send you a new one. If you were not expecting this invitation, you can ignore it.", "", `${PRODUCT_NAME} · ${CLISTE_COMPANY.legalName}`, "support@hellocara.ie"].join("\n");
  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="color-scheme" content="light" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f5;color:#11181d;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div lang="en" dir="ltr" style="display:none;max-height:0;overflow:hidden;opacity:0;">Your invitation to ${escapeHtml(business)}. Set up your access to HelloCara.</div>
<table lang="en" dir="ltr" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f5;"><tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;">
<tr><td style="padding:8px 8px 24px;"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td width="42"><img src="${escapeHtml(input.logoUrl)}" width="32" height="38" alt="HelloCara logo" style="display:block;border:0;object-fit:contain;" /></td><td style="font-size:20px;font-weight:700;letter-spacing:-.7px;color:#353d42;">HelloCara</td></tr></table></td></tr>
<tr><td style="padding:28px 24px;background:#ffffff;border:1px solid #d9e2dd;border-radius:8px;">
<h1 style="margin:0 0 24px;font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-.6px;">Set up your account</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#52616b;">You’ve been invited to manage <strong style="color:#11181d;">${escapeHtml(business)}</strong> on HelloCara.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e7ece9;border-bottom:1px solid #e7ece9;"><tr><td style="padding:13px 0;font-size:13px;color:#68757d;">Organisation</td><td align="right" style="padding:13px 0 13px 12px;font-size:13px;color:#353d42;font-weight:600;">${escapeHtml(organization)}</td></tr></table>
<p style="margin:20px 0;font-size:15px;line-height:1.6;color:#52616b;">${requiresPassword ? "Choose a password and review your organisation’s agreements to open your dashboard." : "Sign in with your existing account and review any outstanding agreements to open your dashboard."}</p>
<table role="presentation" cellspacing="0" cellpadding="0" width="100%"><tr><td align="center" style="border-radius:6px;background:#353d42;"><a href="${escapeHtml(input.actionLink)}" style="display:block;padding:15px 18px;font-size:15px;line-height:1.4;font-weight:600;color:#ffffff;text-decoration:none;">${cta}</a></td></tr></table>
${input.billingMethod === "invoice" || input.billingMethod === "manual_invoice" ? '<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#68757d;">Billing is handled by your organisation, by invoice. No card details needed.</p>' : ''}
</td></tr>
<tr><td style="padding:20px 8px 0;"><p style="margin:0 0 10px;font-size:12px;line-height:1.65;color:#68757d;">This invitation is personal and single-use. If it has expired, reply for a new link. Not expecting this? You can ignore it.</p><p style="margin:0 0 18px;font-size:12px;line-height:1.65;"><a href="mailto:support@hellocara.ie" style="color:#353d42;text-decoration:underline;">Contact HelloCara Support</a></p><p style="margin:0;font-size:11px;line-height:1.6;color:#68757d;">HelloCara · ${escapeHtml(CLISTE_COMPANY.legalName)} · Ireland</p></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
