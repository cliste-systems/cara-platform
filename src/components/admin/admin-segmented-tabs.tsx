import Link from "next/link";

import { adminNavLinkBaseClass } from "@/components/admin/admin-interactive";
import { cn } from "@/lib/utils";

type SegmentedTab = {
  value: string;
  label: string;
  href: string;
};

type AdminSegmentedTabsProps = {
  tabs: SegmentedTab[];
  activeValue: string;
  ariaLabel: string;
};

export function AdminSegmentedTabs({
  tabs,
  activeValue,
  ariaLabel,
}: AdminSegmentedTabsProps) {
  return (
    <div
      className="inline-flex max-w-full flex-wrap rounded-lg border border-[#d9e2dd] bg-[#f3f6f4] p-1"
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map(({ value, label, href }) => {
        const active = activeValue === value;
        return (
          <Link
            key={value}
            href={href}
            role="tab"
            aria-selected={active}
            className={cn(
              adminNavLinkBaseClass,
              "rounded-md px-3.5 py-2 text-sm font-semibold",
              active
                ? "bg-white text-[#11181d] shadow-sm"
                : "text-[#6b7c75] hover:text-[#11181d]",
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
