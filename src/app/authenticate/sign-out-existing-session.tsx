"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function SignOutExistingSession() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setPending(true);
    setError(null);
    try {
      const { error: signOutError } = await createClient().auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
      router.replace("/authenticate");
      router.refresh();
    } catch {
      setError("We couldn’t sign out. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 text-center">
      <button type="button" disabled={pending} onClick={() => void signOut()} className="rounded text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-600 disabled:opacity-50">
        {pending ? "Signing out…" : "Sign out of this account"}
      </button>
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
