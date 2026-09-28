"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { adminNavLinkBaseClass } from "@/components/admin/admin-interactive";
import { createClient } from "@/utils/supabase/client";


export function AdminSignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/authenticate");
    router.refresh();
    setPending(false);
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void handleSignOut()}
      className={`${adminNavLinkBaseClass} group inline-flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-[#5f6f68] hover:bg-[#eef2ef] hover:text-[#11181d] disabled:cursor-not-allowed disabled:opacity-70`}
    >
      <LogOut
        className="size-4 shrink-0 text-[#8b9c94] transition-colors group-hover:text-[#353d42]"
        aria-hidden
      />
      <span>{pending ? "Signing out..." : "Log out"}</span>
    </button>
  );
}
