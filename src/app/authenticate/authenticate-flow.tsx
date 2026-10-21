"use client";

import { useState } from "react";

import { LoginForm } from "@/app/login/login-form";
import { AuthRuledShell } from "@/components/auth/auth-ruled-shell";

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
    <AuthRuledShell
      title="Welcome back"
      subtitle="Sign in to your HelloCara dashboard."
      urlError={urlError}
      contentExiting={panelExiting}
    >
      <LoginForm onTransitionStart={() => setPanelExiting(true)} />
      {showSignOut ? <SignOutExistingSession /> : null}
      {showSignUpLink ? <AuthenticateSignUpLink /> : null}
    </AuthRuledShell>
  );
}
