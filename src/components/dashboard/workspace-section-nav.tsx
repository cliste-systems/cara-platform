"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";
import { usePathname } from "next/navigation";
import { useDashboardVertical } from "@/app/(dashboard)/dashboard/dashboard-vertical-context";
import { cn } from "@/lib/utils";
const links = {
  business: [
    ["/dashboard/business/profile", "Business details"],
    ["/dashboard/business/hours", "Hours & availability"],
    ["/dashboard/cara/greeting", "Greeting & call handling"],
    ["/dashboard/settings/phone-setup", "Phone connection"],
  ],
  account: [
    ["/dashboard/settings", "Account & notifications"],
    ["/dashboard/usage", "Plan & billing"],
    ["/dashboard/team", "Team"],
    ["/dashboard/legal/data-requests", "Privacy & legal"],
  ],
};
export function WorkspaceSectionNav({
  group,
}: {
  group: "business" | "account";
}) {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) menuRef.current.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
        menuRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, []);
  const { vertical } = useDashboardVertical();
  if (vertical.id === "retail") return null;
  const label = group === "business" ? "Your business sections" : "Account sections";
  const current = links[group].find(([href]) => href === pathname)?.[1] ?? "Choose section";
  return (
    <nav aria-label={label} className="relative z-20 shrink-0">
      <details ref={menuRef} key={pathname} className="group sm:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-[#d9e2dd] bg-white px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          {current}<ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-[40dvh] overflow-y-auto rounded-xl border border-[#d9e2dd] bg-white p-1 shadow-lg">
          {links[group].map(([href, text]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[#f3f6f4] aria-[current=page]:bg-[#eaf0ec] aria-[current=page]:font-semibold">{text}{pathname === href && <Check className="size-4" aria-hidden />}</Link>)}
        </div>
      </details>
      <div className="hidden flex-wrap gap-1 rounded-xl border border-[#d9e2dd] bg-[#eaf0ec]/50 p-1 sm:flex">
        {links[group].map(([href, text]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn("inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-white", pathname === href ? "bg-white font-semibold text-[#11181d] shadow-sm ring-1 ring-[#d9e2dd]" : "text-[#5b6b65]")}>{text}</Link>)}
      </div>
    </nav>
  );
}
