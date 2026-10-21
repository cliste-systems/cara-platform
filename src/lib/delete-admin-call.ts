import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";
import { CALL_RECORDINGS_BUCKET, isValidCallRecordingStoragePath } from "@/lib/call-recordings";

export async function deleteAdminCall(callId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: call, error } = await admin.from("call_logs")
    .select("id,organization_id,room_name,audio_storage_path").eq("id", callId).maybeSingle();
  if (error) throw new Error("Could not load this call.");
  if (!call) return false;
  if (call.room_name) {
    const live = await admin.from("admin_live_call_sessions").select("room_name")
      .eq("room_name", call.room_name).eq("active", true)
      .gt("last_seen_at", new Date(Date.now() - 90000).toISOString()).maybeSingle();
    if (live.error) throw new Error("Could not verify whether the call is active.");
    if (live.data) throw new Error("End the call before deleting it.");
  }
  if (call.audio_storage_path) {
    if (!isValidCallRecordingStoragePath(call.audio_storage_path, call.organization_id)) {
      throw new Error("This recording needs manual cleanup before the call can be deleted.");
    }
    const removed = await admin.storage.from(CALL_RECORDINGS_BUCKET).remove([call.audio_storage_path]);
    if (removed.error) throw new Error("Recording cleanup failed. The call has not been deleted; try again.");
  }
  const removed = await admin.rpc("admin_delete_call_history", {
    p_call_id: callId, p_expected_storage_path: call.audio_storage_path,
  });
  if (removed.error) throw new Error("Call cleanup could not finish. Refresh and try again.");
  return Boolean(removed.data);
}
