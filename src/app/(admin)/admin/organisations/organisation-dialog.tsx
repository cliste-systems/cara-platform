"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBillingOrganisation } from "./actions";
type Organisation = { id: string; name: string; billing_email: string | null; billing_address: string | null; billing_contact_name: string | null; billing_vat_number: string | null };
export function OrganisationDialog({ organisation }: { organisation?: Organisation }) {
  const [open, setOpen] = useState(false), [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return <Dialog open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); setMessage(null); } }}>
    <DialogTrigger render={<Button variant="outline" />}>{organisation ? "Edit billing details" : "New organisation"}</DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{organisation ? "Organisation details" : "Create an organisation"}</DialogTitle><DialogDescription>The legal company or group that owns the businesses and receives their invoices.</DialogDescription></DialogHeader>
      <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => { try { const result = await saveBillingOrganisation(data); setMessage(result.message); if (result.ok) setOpen(false); } catch { setMessage("The organisation could not be saved. Please try again."); } }); }} className="space-y-4">
        {organisation && <input type="hidden" name="id" value={organisation.id} />}
        <fieldset disabled={pending} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="org-name">Legal organisation name</Label><Input id="org-name" name="name" defaultValue={organisation?.name} required maxLength={200} placeholder="Murphy Retail Group Ltd" /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="org-email">Invoice email</Label><Input id="org-email" name="email" type="email" defaultValue={organisation?.billing_email ?? ""} required /></div><div className="space-y-2"><Label htmlFor="org-contact">Billing contact</Label><Input id="org-contact" name="contact" defaultValue={organisation?.billing_contact_name ?? ""} maxLength={200} /></div></div>
          <div className="space-y-2"><Label htmlFor="org-address">Billing address</Label><textarea id="org-address" name="address" defaultValue={organisation?.billing_address ?? ""} required maxLength={2000} rows={3} className="w-full rounded-md border p-3 text-sm" /></div>
          <div className="space-y-2"><Label htmlFor="org-vat">VAT number (optional)</Label><Input id="org-vat" name="vat" defaultValue={organisation?.billing_vat_number ?? ""} maxLength={64} /></div>
        </fieldset>
        {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save organisation"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
