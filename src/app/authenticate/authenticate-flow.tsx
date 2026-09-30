"use client";

import { useState } from "react";

import { LoginForm } from "@/app/login/login-form";
import { AuthMarketingShell } from "@/components/auth/auth-marketing-shell";
import { PUBLIC_ASSETS } from "@/lib/public-assets";

import { AuthenticateSignUpLink } from "./authenticate-sign-up-link";
import { SignOutExistingSession } from "./sign-out-existing-session";

type AuthenticateFlowProps = {
  urlError?: string | null;
  showSignUpLink: boolean;
  showSignOut?: boolean;
};

export function AuthenticateFlow({
  urlError,
  showSignUpLink,
  showSignOut = false,
}: AuthenticateFlowProps) {
  const [panelExiting, setPanelExiting] = useState(false);

  return (
    <AuthMarketingShell
      title="Sign in"
      pageBackground={PUBLIC_ASSETS.onboarding.authSignup}
      urlError={urlError}
      contentExiting={panelExiting}
    >
      <LoginForm onTransitionStart={() => setPanelExiting(true)} />
      {showSignOut ? <SignOutExistingSession /> : null}
      {showSignUpLink ? <AuthenticateSignUpLink /> : null}
    </AuthMarketingShell>
  );
}
