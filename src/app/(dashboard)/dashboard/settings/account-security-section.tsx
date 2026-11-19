"use client";
import { FormFeedback } from "@/components/ui/form-feedback";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  changeSignInEmail,
  changeSignInPassword,
} from "./account-actions";
import { SettingsSection } from "./settings-section";

type AccountSecuritySectionProps = {
  signInEmail: string;
  fieldClass: string;
  isLocalPreview?: boolean;
};

export function AccountSecuritySection({
  signInEmail,
  fieldClass,
  isLocalPreview = false,
}: AccountSecuritySectionProps) {
  if (isLocalPreview) {
    return (
      <SettingsSection title="Sign-in & security" id="sign-in-security">
        <div className="rounded-xl border border-[#d9e2dd] bg-[#fbfcfb] px-4 py-3.5 text-[12px] leading-relaxed text-[#35443f]">
          Email and password changes need a real sign-in — they are not available
          in local preview.{" "}
          <Link
            href="/authenticate"
            className="font-semibold text-[#0b1220] underline-offset-2 hover:underline"
          >
            Sign in
          </Link>{" "}
          to update your login email or password here.
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title="Sign-in & security" id="sign-in-security">
      <div className="space-y-6">
        <EmailChangeForm signInEmail={signInEmail} fieldClass={fieldClass} />
        <PasswordChangeForm fieldClass={fieldClass} />
      </div>
    </SettingsSection>
  );
}

function EmailChangeForm({
  signInEmail,
  fieldClass,
}: {
  signInEmail: string;
  fieldClass: string;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    setIsSuccess(false);
    startTransition(async () => {
      const result = await changeSignInEmail({ newEmail });
      if (result.ok) {
        setIsSuccess(true);
        setMessage(result.message ?? "Confirmation emails sent.");
        setNewEmail("");
      } else {
        setIsSuccess(false);
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-[13px] font-semibold text-[#0b1220]">Sign-in email</h3>
        <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
          This is the email you use to sign in — separate from the notification
          email in the Notifications section below.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sign-in-email-current">Current sign-in email</Label>
          <Input
            id="sign-in-email-current"
            type="email"
            readOnly
            tabIndex={-1}
            value={signInEmail}
            className={cn(
              fieldClass,
              "cursor-default bg-slate-50/80 focus-visible:ring-0",
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sign-in-email-new">New sign-in email</Label>
          <Input
            id="sign-in-email-new"
            type="email"
            autoComplete="off"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="you@business.com"
            className={fieldClass}
          />
        </div>
      </div>
      <p className="text-[12px] leading-relaxed text-slate-500">
        You&apos;ll need to confirm this change from both your current and new
        email addresses.
      </p>
      {message ? (
        <FormFeedback message={message} tone={isSuccess ? "success" : "error"} title={isSuccess ? "Updated" : "Please check this"} />
      ) : null}
      <Button
        type="button"
        disabled={pending || !newEmail.trim()}
        onClick={submit}
        className={cn(DASHBOARD_SECONDARY_BUTTON_CLASS, "h-9 px-4 text-[13px]")}
      >
        {pending ? "Sending…" : "Update sign-in email"}
      </Button>
    </div>
  );
}

function PasswordChangeForm({ fieldClass }: { fieldClass: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    setIsSuccess(false);
    startTransition(async () => {
      const result = await changeSignInPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (result.ok) {
        setIsSuccess(true);
        setMessage(result.message ?? "Password updated.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setIsSuccess(false);
        setMessage(result.message);
      }
    });
  }

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0;

  return (
    <div className="space-y-3 border-t border-slate-200/80 pt-5">
      <div>
        <h3 className="text-[13px] font-semibold text-[#0b1220]">Password</h3>
        <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
          You&apos;ll stay signed in after updating.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-new-password">Confirm new password</Label>
          <Input
            id="confirm-new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>
      {message ? (
        <FormFeedback message={message} tone={isSuccess ? "success" : "error"} title={isSuccess ? "Updated" : "Please check this"} />
      ) : null}
      <Button
        type="button"
        disabled={pending || !canSubmit}
        onClick={submit}
        className={cn(DASHBOARD_SECONDARY_BUTTON_CLASS, "h-9 px-4 text-[13px]")}
      >
        {pending ? "Updating…" : "Update password"}
      </Button>
    </div>
  );
}
