"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INVITE_PASSWORD_MIN_LENGTH } from "@/lib/invite-onboarding";
import { setInvitePassword } from "./actions";

export function SetPasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(setInvitePassword, {});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const longEnough = password.length >= INVITE_PASSWORD_MIN_LENGTH;
  const matches = confirm.length > 0 && password === confirm;
  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="invite-email" className="text-[#304b3b]">Your email</Label>
        <div className="relative"><Mail className="pointer-events-none absolute left-3 top-3.5 size-4 text-[#738879]" /><Input id="invite-email" name="username" autoComplete="username" value={email} readOnly className="h-11 border-[#dce5df] bg-[#f5f8f6] pl-10 text-[#52685c]" /></div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password" className="text-[#304b3b]">Create a password</Label>
        <div className="relative"><Input id="new-password" name="password" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={INVITE_PASSWORD_MIN_LENGTH} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby="password-hint" className="h-11 border-[#dce5df] pr-12" /><button type="button" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)} className="absolute right-0 top-0 flex size-11 cursor-pointer items-center justify-center rounded-md text-[#617367] focus-visible:outline-2 focus-visible:outline-[#294c37]">{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>
        <p id="password-hint" className="flex items-center gap-1.5 text-xs leading-5 text-[#617367]">{longEnough ? <Check className="size-3.5 text-[#294c37]" /> : null}At least {INVITE_PASSWORD_MIN_LENGTH} characters. A few memorable words work well.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password" className="text-[#304b3b]">Confirm your password</Label>
        <Input id="confirm-password" name="confirmation" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={INVITE_PASSWORD_MIN_LENGTH} maxLength={128} value={confirm} onChange={(event) => setConfirm(event.target.value)} className="h-11 border-[#dce5df]" />
        {matches ? <p className="flex items-center gap-1.5 text-xs text-[#294c37]"><Check className="size-3.5" />Passwords match</p> : null}
      </div>
      {state.error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800" role="alert">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="h-12 w-full bg-[#294c37] text-sm font-medium text-white hover:bg-[#203e2c]">{pending ? "Securing your account…" : "Save password & continue"}{!pending ? <ArrowRight className="ml-1 size-4" /> : null}</Button>
      <p className="text-center text-xs leading-5 text-[#617367]">Next, review your organisation’s agreements.</p>
    </form>
  );
}
