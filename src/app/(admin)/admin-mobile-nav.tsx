"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { ClisteLogoMark } from "@/components/cliste-logo-mark";

import { AdminNav } from "./admin-nav";

export function AdminMobileNav({ loggedInAs }: { loggedInAs: string }) {
  const pathname = usePathname();
  return <AdminMobileNavContent key={pathname} loggedInAs={loggedInAs} />;
}

function AdminMobileNavContent({ loggedInAs }: { loggedInAs: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-[#d9e2dd] bg-[#fbfcfb] px-4 md:hidden">
        <Link href="/admin" className="flex items-center gap-2.5 text-sm font-semibold text-[#11181d]">
          <ClisteLogoMark size={30} />
          HelloCara Admin
        </Link>
        <button
          type="button"
          aria-label="Open admin navigation"
          aria-controls="admin-mobile-navigation"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="flex size-10 items-center justify-center rounded-lg border border-[#d9e2dd] text-[#353d42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#353d42]"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-[#11181d]/55"
            aria-label="Close admin navigation"
            onClick={() => setOpen(false)}
          />
          <aside id="admin-mobile-navigation" aria-label="Admin navigation" className="relative flex h-full w-[min(86vw,320px)] flex-col bg-[#fbfcfb] shadow-2xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#d9e2dd] px-5">
              <span className="text-sm font-semibold text-[#11181d]">HelloCara Admin</span>
              <button
                type="button"
                aria-label="Close admin navigation"
                onClick={() => setOpen(false)}
                className="flex size-9 items-center justify-center rounded-lg text-[#6b7c75] hover:bg-[#eef2ef] hover:text-[#11181d]"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <AdminNav loggedInAs={loggedInAs} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
