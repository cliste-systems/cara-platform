import { requireAdminMfaSessionUser } from "@/lib/admin-session";
import { loadAdminOverview } from "@/lib/admin-overview";
export async function GET(request: Request) {
  try { await requireAdminMfaSessionUser(); } catch { return Response.json({error:"Session expired"},{status:401}); }
  const params = new URL(request.url).searchParams;
  const integer = (key:string, fallback:number, max:number) => { const n=Number(params.get(key) ?? fallback); return Number.isSafeInteger(n) && n>=0 ? Math.min(n,max) : fallback; };
  try { return Response.json(await loadAdminOverview(integer("page",0,10000), Math.max(1,integer("size",8,50)), integer("issuePage",0,10000), Math.max(1,integer("issueSize",8,50)), params.get("services")!=="0"), {headers:{"Cache-Control":"private, no-store"}}); }
  catch { return Response.json({error:"Overview temporarily unavailable"},{status:503}); }
}
