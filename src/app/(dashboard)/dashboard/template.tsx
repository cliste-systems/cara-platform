"use client";

import { usePathname } from "next/navigation";

import { DashboardPageTransition } from "@/components/dashboard/dashboard-page-transition";
import { dashboardTopLevelAnimateKey } from "@/lib/dashboard-animate-key";

export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const animateKey = dashboardTopLevelAnimateKey(pathname);

  return (
    <DashboardPageTransition
      animateKey={animateKey}
      className="flex h-full min-h-0 flex-1 flex-col"
    >
      {children}
    </DashboardPageTransition>
  );
}
