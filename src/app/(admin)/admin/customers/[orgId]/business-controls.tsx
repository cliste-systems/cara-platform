"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setOrganizationLive, resendOrganizationInvite } from "../../actions";
export function BusinessServiceControl({ id, active, ready, reason }: { id: string; active: boolean; ready: boolean; reason: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition(), [error, setError] = useState<string | null>(null), [confirm, setConfirm] = useState(false);
  return <section className="rounded-xl border border-[#d9e2dd] bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-semibold text-[#11181d]">Cara service</h2><p className="mt-1 text-sm text-slate-500">{active ? "Accepting new calls for this business." : "Paused. Cara is not accepting new calls for this business."}</p></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{active ? "On" : "Off"}</span><Button type="button" variant="outline" disabled={pending || (!active && !ready)} onClick={() => { if (active && !confirm) { setConfirm(true); return; } setError(null); startTransition(async () => { try { const result = await setOrganizationLive(id, !active); if (!result.ok) setError(result.message); else { setConfirm(false); router.refresh(); } } catch { setError("The service could not be updated. Try again."); } }); }}><Power className="size-4" />{pending ? "Updating…" : confirm ? "Confirm turn off" : active ? "Turn Cara off" : "Turn Cara on"}</Button>{confirm && <Button variant="ghost" disabled={pending} onClick={() => setConfirm(false)}>Cancel</Button>}</div></div>{confirm && <p className="mt-3 text-sm text-amber-800">Stops new calls for this business. Calls already connected may continue.</p>}{!active && !ready && <p className="mt-3 text-xs text-slate-500">{reason || "Assign a phone number and complete the required agreements to enable Cara."}</p>}{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</section>;
}
export function BusinessInviteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition(), [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  return <div><Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => { try { const result = await resendOrganizationInvite(id); setMessage(result.ok ? "Invitation sent." : result.message); if (result.ok) router.refresh(); } catch { setMessage("The invitation could not be sent. Try again."); } })}><Mail className="size-3.5" />{pending ? "Sending…" : "Resend invitation"}</Button>{message && <p role="status" className="mt-2 text-xs text-slate-600">{message}</p>}</div>;
}

export function RefreshBusinessButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}><RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />{pending ? "Refreshing…" : "Refresh"}</Button>;
}
