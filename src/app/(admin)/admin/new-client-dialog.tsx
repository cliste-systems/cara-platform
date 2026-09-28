"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { Building2, Check, CheckCircle2, ChevronLeft, FileText, Mail, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientSlug, type ClientAccountOption } from "@/lib/admin-client-account";
import { adminCustomerPath } from "@/lib/admin-route-paths";
import { cn } from "@/lib/utils";
import { createOrganization, listClientAccounts, resendOrganizationInvite, type CreateOrganizationResult } from "./actions";

const STEPS = ["Store details", "Organisation", "Client invitation"];
const controlClass = "border-input bg-background h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function NewClientDialog() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [address, setAddress] = useState("");
  const [eircode, setEircode] = useState("");
  const [assignPhone, setAssignPhone] = useState(true);
  const [accountMode, setAccountMode] = useState<"new" | "existing">("new");
  const [accounts, setAccounts] = useState<ClientAccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [accountName, setAccountName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingContact, setBillingContact] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerMobile, setOwnerMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<CreateOrganizationResult, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const organisationName = accountMode === "new" ? accountName : selectedAccount?.name ?? "";
  const invoiceEmail = accountMode === "new" ? billingEmail : selectedAccount?.billing_email || billingEmail;
  const filteredAccounts = accounts.filter((account) => `${account.name} ${account.billing_email ?? ""}`.toLowerCase().includes(accountSearch.toLowerCase()));

  async function loadAccounts() {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const loaded = await listClientAccounts();
      if (loaded.ok) setAccounts(loaded.accounts);
      else setAccountsError(loaded.message);
    } catch {
      setAccountsError("Organisations could not be loaded. Try again.");
    } finally {
      setAccountsLoading(false);
    }
  }

  function reset() {
    setStep(0); setName(""); setSlug(""); setAddress(""); setEircode(""); setAssignPhone(true);
    setAccountMode("new"); setAccountId(""); setAccountSearch(""); setAccountName("");
    setBillingEmail(""); setBillingContact(""); setBillingAddress(""); setVatNumber("");
    setOwnerName(""); setOwnerEmail(""); setOwnerMobile(""); setError(null); setResult(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const created = await createOrganization({
          name, slug: slug.trim() || clientSlug(name), tier: "native", niche: "retail",
          ownerName, ownerEmail, ownerMobile, address, storefrontEircode: eircode,
          assignPhoneNumber: assignPhone,
          account: accountMode === "existing" ? { mode: "existing", id: accountId, billingEmail, billingAddress } : {
            mode: "new", name: accountName, billingEmail, billingAddress,
            billingContactName: billingContact, billingVatNumber: vatNumber,
          },
          clientOrigin: window.location.origin,
        });
        if (!created.ok) setError(created.message);
        else setResult(created);
      } catch {
        setError("The request could not be completed. Check the customer list before trying again, in case the store was saved.");
      }
    });
  }

  function retryInvite() {
    if (!result) return;
    setError(null);
    startTransition(async () => {
      try {
        const sent = await resendOrganizationInvite(result.organizationId, { email: ownerEmail, name: ownerName });
        if (!sent.ok) setError(sent.message);
        else setResult({ ...result, inviteSent: true, warning: sent.warning });
      } catch {
        setError("The invitation could not be resent. Your store is saved; please try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (pending) return;
      setOpen(next);
      if (next) { reset(); void loadAccounts(); }
    }}>
      <DialogTrigger render={<Button type="button" variant="outline" className="shrink-0 bg-white shadow-sm" />}>New client</DialogTrigger>
      <DialogContent showCloseButton={!pending} className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="pr-7">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"><Store className="size-4" /> Retail onboarding</div>
          <DialogTitle className="text-2xl font-semibold tracking-tight">{result ? "Store created" : "Add a new client"}</DialogTitle>
          <DialogDescription>{result ? "The store and its organisation details are saved." : "Add the store, connect its organisation, then invite your client."}</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-5 py-2">
            <div className={cn("rounded-xl border p-5", result.inviteSent ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")} role="status">
              <div className="flex items-start gap-3">
                {result.inviteSent ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" /> : <Mail className="mt-0.5 size-5 shrink-0 text-amber-700" />}
                <div><p className="font-semibold text-slate-900">{result.inviteSent ? "Invitation sent" : "Invitation needs attention"}</p><p className="mt-1 text-sm text-slate-600">{result.inviteSent ? `We emailed ${ownerEmail}. They can set their password and review the agreements before entering the dashboard.` : "Your store is saved. Retry the invitation here without creating another store."}</p></div>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Store</dt><dd className="mt-1 font-medium">{name}</dd></div>
              <div><dt className="text-slate-500">Organisation</dt><dd className="mt-1 font-medium">{organisationName}</dd></div>
              <div><dt className="text-slate-500">Billing</dt><dd className="mt-1 font-medium">Invoice · no card required</dd></div>
              <div><dt className="text-slate-500">Cara status</dt><dd className="mt-1 font-medium">Offline until store setup is complete</dd></div>
            </dl>
            {result.warning && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">{result.warning}</p>}
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Done</Button>
              {!result.inviteSent && <Button type="button" disabled={pending} onClick={retryInvite}>{pending ? "Sending…" : "Retry invitation"}</Button>}
              <Button variant={result.inviteSent ? "default" : "outline"} render={<Link href={adminCustomerPath(result.organizationId)} />}>Open store</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={(event) => {
            event.preventDefault();
            if (step < 2) { setError(null); setStep(step + 1); }
            else submit();
          }}>
            <ol className="mb-6 flex gap-2 border-b border-slate-200 pb-5" aria-label="Client setup progress">
              {STEPS.map((label, index) => <li key={label} className={cn("flex flex-1 items-center gap-2 text-xs sm:text-sm", index === step ? "font-semibold text-slate-950" : "text-slate-500")} aria-current={index === step ? "step" : undefined}>
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs", index <= step ? "bg-slate-800 text-white" : "bg-slate-100")}>{index < step ? <Check className="size-3.5" /> : index + 1}</span><span>{label}</span>
              </li>)}
            </ol>
            <fieldset disabled={pending} className="min-w-0 space-y-5 pb-5">
              {step === 0 && <>
                <div className="space-y-2"><Label htmlFor={`${id}-name`}>Store name</Label><Input id={`${id}-name`} value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} placeholder="Murphy’s SuperValu Killarney" autoFocus /></div>
                <div className="space-y-2"><Label htmlFor={`${id}-address`}>Store address <span className="font-normal text-slate-400">(optional)</span></Label><Input id={`${id}-address`} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, town, county" /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor={`${id}-eircode`}>Eircode <span className="font-normal text-slate-400">(optional)</span></Label><Input id={`${id}-eircode`} value={eircode} onChange={(event) => setEircode(event.target.value.toUpperCase())} placeholder="V93 XXXX" /></div>
                  <div className="space-y-2"><Label htmlFor={`${id}-slug`}>Store identifier</Label><Input id={`${id}-slug`} value={slug || clientSlug(name)} onChange={(event) => setSlug(event.target.value.toLowerCase())} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} required className="text-sm" /></div>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4"><input type="checkbox" className="mt-1" checked={assignPhone} onChange={(event) => setAssignPhone(event.target.checked)} /><span><span className="block font-medium">Assign an Irish phone number</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">Use an available number from the phone pool. Cara stays offline while the store is being configured.</span></span></label>
              </>}
              {step === 1 && <>
                <div><h3 className="font-semibold">Who owns this store?</h3><p className="mt-1 text-sm text-slate-500">Use the legal company or group name. One organisation can own several stores and share invoice details.</p></div>
                <div className="grid grid-cols-2 gap-3">
                  {(["new", "existing"] as const).map((mode) => <label key={mode} className={cn("flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-medium", accountMode === mode ? "border-slate-700 bg-slate-50" : "border-slate-200")}><input type="radio" name={`${id}-mode`} value={mode} checked={accountMode === mode} onChange={() => setAccountMode(mode)} />{mode === "new" ? "Create organisation" : "Select existing"}</label>)}
                </div>
                {accountMode === "existing" ? <div className="space-y-3">
                  {accountsLoading ? <p className="text-sm text-slate-500" role="status">Loading organisations…</p> : accountsError ? <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800"><p>{accountsError}</p><Button type="button" variant="outline" className="mt-2" onClick={() => void loadAccounts()}>Try again</Button></div> : accounts.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No active organisations with invoice billing are available yet. Choose Create organisation to add one.</p> : <>
                    <div className="space-y-2"><Label htmlFor={`${id}-search`}>Find an organisation</Label><Input id={`${id}-search`} type="search" placeholder="Search by name or invoice email" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor={`${id}-account`}>Organisation</Label><select id={`${id}-account`} className={controlClass} value={accountId} onChange={(event) => { setAccountId(event.target.value); setBillingEmail(""); setBillingAddress(""); }} required><option value="">Select an organisation</option>{filteredAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.storeCount} {account.storeCount === 1 ? "store" : "stores"}</option>)}</select></div>
                    {filteredAccounts.length === 0 && <p className="text-xs text-slate-500">No organisations match this search.</p>}
                    {selectedAccount && !selectedAccount.billing_email?.trim() && <div className="space-y-2"><Label htmlFor={`${id}-existing-email`}>Organisation invoice email</Label><Input id={`${id}-existing-email`} type="email" required value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} placeholder="accounts@company.ie" /></div>}
                    {selectedAccount && !selectedAccount.billing_address?.trim() && <div className="space-y-2"><Label htmlFor={`${id}-existing-address`}>Organisation billing address</Label><textarea id={`${id}-existing-address`} required rows={2} className={cn(controlClass, "h-auto py-2")} value={billingAddress} onChange={(event) => setBillingAddress(event.target.value)} placeholder="Registered company address, including Eircode" /></div>}
                    {selectedAccount && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><p className="font-medium">{selectedAccount.name}</p><p className="mt-1 text-slate-600">{selectedAccount.billing_email || "Invoice email not yet recorded"}</p><p className="mt-1 whitespace-pre-line text-slate-500">{selectedAccount.billing_address || "Billing address not yet recorded"}</p><p className="mt-3 text-xs text-slate-500">This store will share the organisation’s invoice billing details.</p></div>}
                  </>}
                </div> : <>
                  <div className="space-y-2"><Label htmlFor={`${id}-company`}>Legal organisation name</Label><Input id={`${id}-company`} value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Murphy Retail Group Ltd" required maxLength={200} /></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor={`${id}-billing-email`}>Invoice email</Label><Input id={`${id}-billing-email`} type="email" value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} required placeholder="accounts@company.ie" /></div>
                    <div className="space-y-2"><Label htmlFor={`${id}-billing-contact`}>Billing contact <span className="font-normal text-slate-400">(optional)</span></Label><Input id={`${id}-billing-contact`} value={billingContact} onChange={(event) => setBillingContact(event.target.value)} placeholder="Accounts team" /></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor={`${id}-billing-address`}>Billing address</Label><textarea id={`${id}-billing-address`} value={billingAddress} onChange={(event) => setBillingAddress(event.target.value)} required rows={2} className={cn(controlClass, "h-auto py-2")} placeholder="Registered company address, including Eircode" /></div>
                  <div className="space-y-2"><Label htmlFor={`${id}-vat`}>VAT number <span className="font-normal text-slate-400">(optional)</span></Label><Input id={`${id}-vat`} value={vatNumber} onChange={(event) => setVatNumber(event.target.value)} placeholder="IE…" /></div>
                </>}
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4"><FileText className="mt-0.5 size-4 shrink-0 text-slate-500" /><p className="text-xs leading-relaxed text-slate-600">Billing is by invoice for the organisation. No payment card is needed during client setup.</p></div>
              </>}
              {step === 2 && <>
                <div><h3 className="font-semibold">Invite the organisation’s contact</h3><p className="mt-1 text-sm text-slate-500">This person will have access to every store in {organisationName || "the organisation"}. Use someone authorised to act for the business.</p></div>
                <div className="space-y-2"><Label htmlFor={`${id}-owner`}>Contact name</Label><Input id={`${id}-owner`} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} autoComplete="name" required placeholder="Mary Murphy" /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor={`${id}-email`}>Invitation email</Label><Input id={`${id}-email`} type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} autoComplete="email" required placeholder="mary@company.ie" /></div>
                  <div className="space-y-2"><Label htmlFor={`${id}-mobile`}>Mobile <span className="font-normal text-slate-400">(optional)</span></Label><Input id={`${id}-mobile`} type="tel" value={ownerMobile} onChange={(event) => setOwnerMobile(event.target.value)} placeholder="+353 87 123 4567" /></div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 font-medium"><Building2 className="size-4 text-slate-500" />{organisationName}</div><p className="mt-2 text-sm text-slate-600">{name}</p><p className="mt-1 text-xs text-slate-500">Invoice billing{invoiceEmail ? ` · ${invoiceEmail}` : ""}</p></div>
                <div className="rounded-xl border border-slate-200 p-4"><h4 className="flex items-center gap-2 text-sm font-medium"><Mail className="size-4 text-slate-500" /> What your client receives</h4><ol className="mt-3 space-y-2 text-sm text-slate-600"><li>1. A branded email with a secure setup link.</li><li>2. A password setup page for a new account.</li><li>3. The agreements to review before dashboard access.</li></ol><p className="mt-3 text-xs leading-relaxed text-slate-500">If this email already has access to the same organisation, their existing login is kept.</p></div>
              </>}
            </fieldset>
            {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="outline" disabled={pending} onClick={() => { setError(null); if (step > 0) setStep(step - 1); else setOpen(false); }}>{step > 0 && <ChevronLeft className="size-4" />}{step > 0 ? "Back" : "Cancel"}</Button>
              <Button type="submit" disabled={pending || (step === 1 && accountMode === "existing" && (!selectedAccount || accountsLoading || Boolean(accountsError)))}>{pending ? "Creating client…" : step < 2 ? "Continue" : "Create client & send invitation"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
