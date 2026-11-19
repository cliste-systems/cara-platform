import Link from "next/link";
import { BusinessHoursTab } from "../../../cara-setup/business-profile-tab";
export default function BusinessHoursPage() {
  return (
    <div>
      <BusinessHoursTab />
      <div className="border-t border-[#dfe7e2] p-5 text-sm text-[#5b6b65]">
        To change outside-hours availability or message alerts, open{" "}
        <Link href="/dashboard/settings#call-preferences" className="no-underline">
          call preferences
        </Link>
        .
      </div>
    </div>
  );
}
