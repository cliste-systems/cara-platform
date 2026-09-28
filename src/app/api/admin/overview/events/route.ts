import { requireAdminMfaSessionUser } from "@/lib/admin-session";
import { createAdminClient } from "@/utils/supabase/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
// Relay invalidations only. Tenant data and service credentials never enter this stream.
export async function GET(request:Request) {
  try { await requireAdminMfaSessionUser(); } catch { return new Response(null,{status:401}); }
  const admin=createAdminClient();
  const encoder=new TextEncoder();
  let finish=(_close=true)=>{};
  const stream=new ReadableStream<Uint8Array>({
    start(controller) {
      let closed=false;
      const send=(event:string)=>{if(!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: {}\n\n`));};
      const channel=admin.channel(`admin-overview-${crypto.randomUUID()}`)
        .on("postgres_changes",{event:"*",schema:"public",table:"usage_records"},()=>send("call"))
        .on("postgres_changes",{event:"*",schema:"public",table:"call_logs"},()=>send("call"))
        .on("postgres_changes",{event:"*",schema:"public",table:"admin_live_call_sessions"},()=>send("call"))
        .subscribe(status=>{if(status==="SUBSCRIBED") send("ready");});
      const heartbeat=setInterval(()=>send("ping"),15000);
      const expiry=setTimeout(()=>finish(),55000);
      finish=(close=true)=>{if(closed)return;closed=true;clearInterval(heartbeat);clearTimeout(expiry);void admin.removeChannel(channel);request.signal.removeEventListener("abort",abort);if(close)controller.close();};
      const abort=()=>finish();
      request.signal.addEventListener("abort",abort,{once:true});
      if(request.signal.aborted) finish();
    },
    cancel(){finish(false);},
  });
  return new Response(stream,{headers:{"Content-Type":"text/event-stream","Cache-Control":"private, no-cache, no-transform","X-Accel-Buffering":"no"}});
}
