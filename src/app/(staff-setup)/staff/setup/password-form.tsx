"use client";
import { useActionState, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INVITE_PASSWORD_MIN_LENGTH } from "@/lib/invite-onboarding";
import { setStaffPassword } from "./actions";

export function StaffPasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(setStaffPassword, {});
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  return <form action={action} className="space-y-5"><div className="space-y-2"><Label htmlFor="staff-setup-email">Work email</Label><Input id="staff-setup-email" autoComplete="username" name="username" value={email} readOnly className="h-11 bg-[#f5f8f6] text-[#52685c]" /></div><div className="space-y-2"><Label htmlFor="staff-password">Create your password</Label><div className="relative"><Input id="staff-password" name="password" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={INVITE_PASSWORD_MIN_LENGTH} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby="staff-password-hint" className="h-11 pr-12" /><button type="button" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)} className="absolute right-0 top-0 flex size-11 items-center justify-center text-[#617367]">{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div><p id="staff-password-hint" className="text-xs leading-5 text-[#617367]">Use at least {INVITE_PASSWORD_MIN_LENGTH} characters. A few memorable words work well.</p></div><div className="space-y-2"><Label htmlFor="staff-password-confirm">Confirm password</Label><Input id="staff-password-confirm" name="confirmation" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={INVITE_PASSWORD_MIN_LENGTH} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-11" />{password && password === confirmation ? <p className="flex items-center gap-1.5 text-xs text-[#294c37]"><Check className="size-3.5" />Passwords match</p> : null}</div>{state.error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">{state.error}</p> : null}<Button type="submit" disabled={pending} className="h-12 w-full bg-[#294c37] text-white hover:bg-[#203e2c]">{pending ? "Saving your password…" : "Continue to security setup"}{!pending ? <ArrowRight className="size-4" /> : null}</Button><p className="text-center text-xs leading-6 text-[#617367]">Next, connect an authenticator app to protect your account.</p></form>;
}
