import { requireAdminMfaSessionUser } from "@/lib/admin-session";
import { isSameOriginRequest } from "@/lib/request-origin";
import { createAdminClient } from "@/utils/supabase/admin";
import { RoomServiceClient } from "livekit-server-sdk";
import { livekitHttpHostFromEnv } from "@/lib/livekit-phone-numbers";
export async function POST(request:Request) {
  try { await requireAdminMfaSessionUser(); } catch { return Response.json({error:"Unauthorized"},{status:401}); }
  if(!isSameOriginRequest(request)) return Response.json({error:"Invalid origin"},{status:403});
  let roomName:string, ended:boolean;
  try {const body=await request.json();roomName=body.roomName;ended=body.ended===true;if(typeof roomName!=="string"||!/^admin-demo-[a-f0-9-]{36}$/.test(roomName))throw new Error();}catch{return Response.json({error:"Invalid session"},{status:400});}
  const admin=createAdminClient();
  try {
    const existing=await admin.from("admin_live_call_sessions").select("room_name").eq("room_name",roomName).maybeSingle();
    if(existing.error)throw existing.error;
    if(!existing.data){
      // Recover sessions created before presence tracking was enabled using trusted room metadata.
      const client=new RoomServiceClient(livekitHttpHostFromEnv(),process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET);
      const [room]=await client.listRooms([roomName]);
      if(!room)return new Response(null,{status:204});
      const meta=JSON.parse(room.metadata);
      if(meta.source!=="admin_simulator"||!meta.organization_id)return Response.json({error:"Invalid room"},{status:400});
      const created=await admin.from("admin_live_call_sessions").upsert({room_name:roomName,organization_id:meta.organization_id,caller_number:meta.caller_number},{onConflict:"room_name",ignoreDuplicates:true});
      if(created.error)throw created.error;
    }
    const now=new Date().toISOString();
    const result=await admin.from("admin_live_call_sessions").update({active:!ended,last_seen_at:now,...(ended?{ended_at:now}:{})}).eq("room_name",roomName).is("ended_at",null);
    if(result.error)throw result.error;
    return new Response(null,{status:204});
  }catch{return Response.json({error:"Could not update live session"},{status:503});}
}
