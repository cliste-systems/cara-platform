import "server-only";

import {
  CALL_RECORDINGS_BUCKET,
  callRecordingContentType,
  isValidCallRecordingStoragePath,
} from "@/lib/call-recordings";
import { createAdminClient } from "@/utils/supabase/admin";

import { CALL_MEDIA_RETENTION_MS } from "@/lib/call-media-retention";

const SIGNED_URL_TTL_SECONDS = 300;

export async function createCallRecordingSignedUrl(input: {
  organizationId: string;
  callLogId: string;
  storagePath: string;
}): Promise<string | null> {
  if (
    !isValidCallRecordingStoragePath(input.storagePath, input.organizationId)
  ) {
    return null;
  }

  const admin = createAdminClient();
  const { data: row, error: rowError } = await admin
    .from("call_logs")
    .select("id")
    .eq("id", input.callLogId)
    .eq("organization_id", input.organizationId)
    .eq("audio_storage_path", input.storagePath)
    .is("caller_data_erased_at", null)
    .gt("created_at", new Date(Date.now() - CALL_MEDIA_RETENTION_MS).toISOString())
    .maybeSingle();

  if (rowError || !row?.id) return null;

  const { data, error } = await admin.storage
    .from(CALL_RECORDINGS_BUCKET)
    .createSignedUrl(input.storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function deleteCallRecordingObjects(
  storagePaths: string[],
): Promise<number> {
  const paths = [...new Set(storagePaths.map((p) => p.trim()).filter(Boolean))];
  if (paths.length === 0) return 0;

  const admin = createAdminClient();
  let deleted = 0;
  for (let offset = 0; offset < paths.length; offset += 100) {
    const batch = paths.slice(offset, offset + 100);
    const { error } = await admin.storage.from(CALL_RECORDINGS_BUCKET).remove(batch);
    if (error) {
      console.error("[call-recordings] storage remove failed", error.message);
      throw new Error("Recording deletion failed. Please retry.");
    }
    deleted += batch.length;
  }
  return deleted;
}

export async function uploadCallRecordingFromWorker(input: {
  organizationId: string;
  callLogId: string;
  storagePath: string;
  body: Buffer | Uint8Array;
}): Promise<boolean> {
  if (
    !isValidCallRecordingStoragePath(input.storagePath, input.organizationId)
  ) {
    return false;
  }

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(CALL_RECORDINGS_BUCKET)
    .upload(input.storagePath, input.body, {
      contentType: callRecordingContentType(input.storagePath),
      upsert: true,
    });

  if (error) {
    console.error("[call-recordings] upload failed", error.message);
    return false;
  }

  const { data: patched, error: patchError } = await admin
    .from("call_logs")
    .update({ audio_storage_path: input.storagePath })
    .eq("id", input.callLogId)
    .eq("organization_id", input.organizationId)
    .is("caller_data_erased_at", null)
    .select("id");

  if (patchError || !patched?.length) {
    const { error: cleanupError } = await admin.storage.from(CALL_RECORDINGS_BUCKET).remove([input.storagePath]);
    if (cleanupError) {
      const { error: queueError } = await admin.from("call_recording_cleanup").upsert({storage_path:input.storagePath,organization_id:input.organizationId},{onConflict:"storage_path",ignoreDuplicates:true});
      if (queueError) console.error("[call-recordings] CRITICAL cleanup could not be queued");
    }
    console.error("[call-recordings] call_logs patch failed", patchError?.message ?? "Call erased or unavailable");
    return false;
  }

  return true;
}
