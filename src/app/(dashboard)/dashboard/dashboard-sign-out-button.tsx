"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

import { clearDashboardSessionCookies } from "./actions";

export function DashboardSignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    await clearDashboardSessionCookies();
    router.push("/authenticate");
    router.refresh();
    setPending(false);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      onClick={() => void handleSignOut()}
      className="group min-h-11 w-full justify-start gap-2.5 rounded-[10px] px-3 text-[13px] font-normal text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
    >
      <LogOut
        className="size-[18px] shrink-0 text-[#94a3b8] group-hover:text-[#64748b]"
        aria-hidden
      />
      {pending ? "Signing out…" : "Log out"}
    </Button>
  );
}
