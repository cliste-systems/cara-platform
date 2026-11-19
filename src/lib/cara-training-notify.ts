import type { SupabaseClient } from "@supabase/supabase-js";
/** Durable per-channel jobs; the owner-alert scheduler delivers and retries them. */
export async function notifyCaraTrainingOwner(admin: SupabaseClient, organizationId: string, input: {itemId:string;gapSummary:string}): Promise<void> {
 const {error}=await admin.from('knowledge_notifications').upsert(['email','sms'].map(channel=>({item_id:input.itemId,organization_id:organizationId,channel})),{onConflict:'item_id,channel',ignoreDuplicates:true});
 if(error)throw new Error('Knowledge notification could not be queued.');
}
