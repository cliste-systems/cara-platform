import { redirect } from "next/navigation";
import { isActiveAdminSession } from "@/lib/admin-sessions";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export async function requireStaffPasswordSetup() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/authenticate");
  if (!(await isActiveAdminSession(user, supabase))) redirect("/authenticate?error=session_expired&message=This%20session%20has%20ended.%20Please%20sign%20in%20again.");
  const admin = createAdminClient();
  const { data: staff, error: staffError } = await admin.from("admin_staff").select("user_id,email,display_name,status").eq("user_id", user.id).maybeSingle();
  if (staffError || !staff || staff.status === "disabled" || user.email?.toLowerCase() !== staff.email) redirect("/authenticate?error=forbidden&message=This%20team%20invitation%20is%20no%20longer%20available.");
  if (user.app_metadata?.admin_needs_password !== true) redirect("/admin");
  return { supabase, admin, user, staff };
}
