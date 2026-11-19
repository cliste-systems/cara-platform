import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/request-origin";
import { dismissFirstCallWelcome } from "@/app/(dashboard)/dashboard/first-call-actions";

/** Route response avoids a Server Action replacing the completion scene mid-transition. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ok:false},{status:403});
  try {
    const result = await dismissFirstCallWelcome();
    return NextResponse.json(result,{status:result.ok?200:409,headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({ok:false},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
