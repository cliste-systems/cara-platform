"use client";

import { useActionState, useState } from "react";
import { Check, KeyRound, Loader2, LogOut, Monitor, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminSession } from "@/lib/admin-sessions";
import { changeAdminPassword, revokeOwnAdminSession, type AdminSecurityState } from "./actions";

const initialState: AdminSecurityState = {};

function ActionMessage({ state }: { state: AdminSecurityState }) {
  if (!state.error && !state.success) return null;
  return <p role={state.error ? "alert" : "status"} className={`rounded-lg border px-3 py-2.5 text-sm ${state.error ? "border-red-200 bg-red-50 text-red-700" : "border-[#e0e3e6] bg-[#f5f6f7] text-[#353d42]"}`}>{state.error ?? state.success}</p>;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Dublin" }).format(date);
}

export function AdminSecuritySettings({ email, sessions, sessionsAvailable }: { email: string; sessions: AdminSession[]; sessionsAvailable: boolean }) {
  const [passwordState, passwordAction, savingPassword] = useActionState(changeAdminPassword, initialState);
  const [sessionState, sessionAction, revoking] = useActionState(revokeOwnAdminSession, initialState);
  const [confirming, setConfirming] = useState<string | null>(null);
  const otherCount = sessions.filter((session) => !session.isCurrent).length;

  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
    <section className="rounded-xl border border-[#e0e3e6] bg-white shadow-sm">
      <div className="border-b border-[#e9ebed] p-5">
        <div className="flex items-center gap-2.5"><KeyRound className="size-4 text-[#667078]" aria-hidden /><h2 className="text-base font-semibold text-[#11181d]">Sign-in details</h2></div>
        <p className="mt-2 break-all text-sm text-[#667078]">{email}</p>
      </div>
      <div className="p-5">
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-[#f5f6f7] p-3.5 text-sm text-[#535d65]"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /><div><p className="font-medium">Two-step verification is on</p><p className="mt-1 text-xs leading-5">Your authenticator protects access to the admin workspace.</p></div></div>
        <form action={passwordAction} className="space-y-4">
          <div><label htmlFor="new-password" className="mb-2 block text-sm font-medium text-[#353d42]">New password</label><Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className="h-10" /><p className="mt-1.5 text-xs text-[#78828a]">Use at least 12 characters.</p></div>
          <div><label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-[#353d42]">Confirm new password</label><Input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className="h-10" /></div>
          <ActionMessage state={passwordState} />
          <Button type="submit" disabled={savingPassword} className="h-10 w-full">{savingPassword ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}{savingPassword ? "Saving password…" : "Update password"}</Button>
          <p className="text-xs leading-5 text-[#78828a]">Changing your password also signs out your other sessions.</p>
        </form>
      </div>
    </section>

    <section className="min-w-0 rounded-xl border border-[#e0e3e6] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e9ebed] p-5">
        <div><div className="flex items-center gap-2.5"><Monitor className="size-4 text-[#667078]" aria-hidden /><h2 className="text-base font-semibold text-[#11181d]">Signed-in sessions</h2></div><p className="mt-2 text-xs leading-5 text-[#78828a]">Review your devices and sign out any you no longer use.</p></div>
        {sessionsAvailable && otherCount > 0 && <Button type="button" variant="outline" size="sm" onClick={() => setConfirming("others")} disabled={revoking}>Sign out other sessions</Button>}
      </div>
      <div className="space-y-4 p-5">
        <ActionMessage state={sessionState} />
        {confirming === "others" && <form action={sessionAction} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4" onSubmit={() => setConfirming(null)}>
          <input type="hidden" name="mode" value="others" /><p className="text-sm text-amber-950">Sign out {otherCount} other {otherCount === 1 ? "session" : "sessions"}? You’ll stay signed in on this device.</p><div className="flex flex-wrap gap-2"><Button type="submit" size="sm" disabled={revoking}>Confirm sign out</Button><Button type="button" size="sm" variant="outline" onClick={() => setConfirming(null)}>Cancel</Button></div>
        </form>}
        {sessionsAvailable && sessions.length === 0 && <p className="text-sm text-[#78828a]">No active sessions were found. Refresh this page to check again.</p>}
        {sessions.map((session) => <div key={session.id} className="rounded-xl border border-[#e9ebed] p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#f1f3f5] text-[#667078]"><Monitor className="size-5" aria-hidden /></span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-[#353d42]">{session.device}</p>{session.isCurrent && <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f3f5] px-2 py-0.5 text-[11px] font-medium text-[#353d42]"><Check className="size-3" aria-hidden />This device</span>}</div><p className="mt-1 text-xs text-[#78828a]">{session.ipMasked ? `Network ${session.ipMasked}` : "Network unavailable"}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-[#78828a]"><span>Signed in {formatTime(session.createdAt)}</span><span>Last refreshed {formatTime(session.lastActiveAt)}</span></div>{!session.mfaVerified && <p className="mt-2 text-xs text-amber-700">Awaiting two-step verification</p>}</div>
          </div>
          <div className="mt-3 flex justify-end"><Button type="button" variant="outline" size="sm" onClick={() => setConfirming(session.id)} disabled={revoking}><LogOut className="size-3.5" aria-hidden />Sign out</Button></div>
          {confirming === session.id && <form action={sessionAction} onSubmit={() => setConfirming(null)} className="mt-3 space-y-3 border-t border-[#e9ebed] pt-3"><input type="hidden" name="mode" value="one" /><input type="hidden" name="sessionId" value={session.id} />{session.isCurrent && <input type="hidden" name="confirmCurrent" value="yes" />}<p className="text-sm text-[#59636b]">{session.isCurrent ? "Sign out of this device? You’ll return to the sign-in page." : "Sign out this session? That device will need to sign in again."}</p><div className="flex gap-2"><Button type="submit" size="sm" disabled={revoking}>Confirm sign out</Button><Button type="button" variant="outline" size="sm" onClick={() => setConfirming(null)}>Cancel</Button></div></form>}
        </div>)}
        {revoking && <p role="status" className="flex items-center gap-2 text-sm text-[#667078]"><Loader2 className="size-4 animate-spin" aria-hidden />Signing out…</p>}
        <p className="text-xs leading-5 text-[#78828a]">Times shown in Ireland time. Each browser or app can have its own session.</p>
      </div>
    </section>
  </div>;
}
