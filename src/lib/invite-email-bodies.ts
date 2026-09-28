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
<body style="margin:0;padding:0;background:#f2f5f3;color:#182622;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<div lang="en" dir="ltr" style="display:none;max-height:0;overflow:hidden;opacity:0;">Your store is ready for account setup. ${requiresPassword ? "Choose a password, then review your agreements." : "Sign in and review your agreements."}</div>
<table lang="en" dir="ltr" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f5f3;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#ffffff;border:1px solid #d9e4de;border-radius:20px;overflow:hidden;">
<tr><td style="padding:30px 32px 24px;border-bottom:1px solid #e4ebe7;"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="font-size:20px;font-weight:700;letter-spacing:-.5px;">HelloCara</td></tr></table></td></tr>
<tr><td style="padding:32px;"><p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase;color:#4e6b5c;">Your store workspace</p><h1 style="margin:0 0 20px;font-size:29px;line-height:1.2;font-weight:650;letter-spacing:-.7px;">Welcome to HelloCara</h1><p style="margin:0 0 12px;font-size:16px;line-height:1.6;">${escapeHtml(greeting)}</p><p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#475b51;">We’ve prepared your access to <strong style="color:#182622;">${escapeHtml(business)}</strong>. A few short steps will get your account ready.</p>
<div style="padding:18px 20px;border:1px solid #dce7e0;border-radius:12px;background:#f5f8f6;margin:0 0 24px;"><p style="margin:0 0 5px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#52685c;">Organisation</p><p style="margin:0;font-size:16px;font-weight:600;color:#182622;">${escapeHtml(organization)}</p></div>
<ol style="margin:0 0 28px;padding-left:22px;font-size:15px;line-height:1.7;color:#475b51;">${steps.map((step) => `<li style="padding:3px 0;">${escapeHtml(step)}</li>`).join("")}</ol>
<table role="presentation" cellspacing="0" cellpadding="0" width="100%"><tr><td align="center" style="border-radius:10px;background:#244936;"><a href="${escapeHtml(input.actionLink)}" style="display:block;padding:16px 20px;font-size:16px;line-height:1.4;font-weight:600;color:#ffffff;text-decoration:none;">${cta} &rarr;</a></td></tr></table>
<p style="margin:22px 0 0;font-size:14px;line-height:1.7;color:#52685c;">${escapeHtml(billing)}</p></td></tr>
<tr><td style="padding:24px 32px;background:#f8faf8;border-top:1px solid #e4ebe7;"><p style="margin:0 0 12px;font-size:13px;line-height:1.7;color:#52685c;">This is a personal, single-use invitation. If it has expired, reply to this email for a new link. If you weren’t expecting it, you can ignore this email.</p><p style="margin:0;font-size:13px;line-height:1.7;color:#52685c;">Need a hand? <a href="mailto:support@hellocara.ie" style="color:#244936;text-decoration:underline;">Contact HelloCara Support</a></p></td></tr></table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.7;color:#52685c;">HelloCara · ${escapeHtml(CLISTE_COMPANY.legalName)} · Ireland</p>
</td></tr></table></body></html>`;
  return { subject, text, html };
}
