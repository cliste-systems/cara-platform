import { NextResponse } from 'next/server';
import { timingSafeEqualUtf8 } from '@/lib/timing-safe-equal';
import { processOwnerCallAlerts } from '@/lib/owner-call-sms-alerts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function run(request: Request) {
  // The backend scheduler uses the same Vault-held credential as call-analysis.
  const secret = process.env.CALL_ANALYSIS_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get('authorization');
  const candidate = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!secret || !candidate || !(await timingSafeEqualUtf8(candidate, secret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, ...await processOwnerCallAlerts() });
  } catch {
    return NextResponse.json({ ok: false, error: 'Call alerts could not be processed.' }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
