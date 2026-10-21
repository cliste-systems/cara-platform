import {NextResponse} from 'next/server';
import {timingSafeEqualUtf8} from '@/lib/timing-safe-equal';
import {processOwnerCallAlerts} from '@/lib/owner-call-sms-alerts';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET?.trim();
 const candidate=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
 if(!secret||!candidate||!(await timingSafeEqualUtf8(candidate,secret)))return NextResponse.json({error:'Unauthorized'},{status:401});
 try{return NextResponse.json({ok:true,...await processOwnerCallAlerts()});}
 catch{return NextResponse.json({ok:false,error:'Call alerts could not be processed.'},{status:500});}
}
