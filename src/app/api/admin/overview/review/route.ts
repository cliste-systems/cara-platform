import { requireAdminMfaSessionUser } from "@/lib/admin-session";
import { isSameOriginRequest } from "@/lib/request-origin";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: Request) {
  let user;
  try { user = await requireAdminMfaSessionUser(); }
  catch { return Response.json({ error: "Session expired" }, { status: 401 }); }
  if (!isSameOriginRequest(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  let callId: string, signature: string;
  try {
    const body = await request.json();
    callId = body.callId; signature = body.signature;
    if (typeof callId !== "string" || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(callId)
      || typeof signature !== "string" || !/^[a-f0-9]{32}$/.test(signature)) throw new Error();
  } catch { return Response.json({ error: "Invalid issue" }, { status: 400 }); }
  const result = await createAdminClient().rpc("admin_review_overview_issue", {
    p_call_id: callId, p_signature: signature, p_user_id: user.id,
  });
  if (result.error) return Response.json({ error: "Could not mark this issue reviewed" }, { status: 503 });
  if (!result.data) return Response.json({ error: "This call has changed. Refresh and inspect the latest evidence." }, { status: 409 });
  return new Response(null, { status: 204 });
}
