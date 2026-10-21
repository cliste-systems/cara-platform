import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export function SignupSetupBanner() {
  return <section className="shrink-0 rounded-lg border border-[#e0e3e6] bg-[#f7f8f9] px-5 py-4">
    <h2 className="text-sm font-semibold text-[#11181d]">Set up Cara for your business</h2>
    <p className="mt-1 text-xs leading-5 text-[#697078]">Add your business details and call settings here. Your account is ready; Cara is configured separately.</p>
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-[#353d42]">
      {[[DASHBOARD_ROUTES.businessProfile,"Business details"],[DASHBOARD_ROUTES.businessServices,"Services"],[DASHBOARD_ROUTES.businessAnswers,"Questions & answers"],[DASHBOARD_ROUTES.caraGreeting,"Greeting"],[DASHBOARD_ROUTES.settings,"Call settings"]].map(([href,label])=><Link key={href} href={href} className="inline-flex items-center gap-1 hover:underline">{label}<ArrowRight size={12} aria-hidden /></Link>)}
    </div>
  </section>;
}
