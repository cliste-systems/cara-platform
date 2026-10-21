import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { timingSafeEqualUtf8 } from './timing-safe-equal';

function fixture(env: Record<string, string> = {}, failure = false) {
  let processed = 0;
  const imports: Record<string, unknown> = {
    'next/server': { NextResponse: { json: (body: unknown, options?: ResponseInit) => Response.json(body, options) } },
    '@/lib/timing-safe-equal': { timingSafeEqualUtf8 },
    '@/lib/owner-call-sms-alerts': { processOwnerCallAlerts: async () => {
      processed++;
      if (failure) throw new Error('Private provider details');
      return { processed: 0 };
    } },
  };
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(
    readFileSync(new URL('../app/api/cron/owner-call-alerts/route.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText, {
    module: mod, exports: mod.exports, process: { env },
    require: (name: string) => {
      if (!imports[name]) throw new Error(name);
      return imports[name];
    },
  });
  const handlers = mod.exports as Record<'GET' | 'POST', (request: Request) => Promise<Response>>;
  return { handlers, processed: () => processed };
}

for (const method of ['GET', 'POST'] as const) {
  test(`${method} accepts the backend scheduler credential`, async () => {
    const f = fixture({ CALL_ANALYSIS_CRON_SECRET: ' scheduler-secret ', CRON_SECRET: 'other-secret' });
    const result = await f.handlers[method](new Request('https://example.com', { method, headers: { authorization: 'Bearer scheduler-secret' } }));
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { ok: true, processed: 0 });
    assert.equal(f.processed(), 1);
  });
}

test('unauthorized requests never drain the SMS queue', async () => {
  const f = fixture({ CALL_ANALYSIS_CRON_SECRET: 'scheduler-secret', CRON_SECRET: 'other-secret' });
  for (const authorization of ['', 'scheduler-secret', 'Bearer wrong-secret', 'Bearer other-secret']) {
    const result = await f.handlers.POST(new Request('https://example.com', { method: 'POST', headers: { authorization } }));
    assert.equal(result.status, 401);
  }
  assert.equal(f.processed(), 0);
});

test('missing server credentials fail closed', async () => {
  const f = fixture();
  const result = await f.handlers.POST(new Request('https://example.com', { method: 'POST', headers: { authorization: 'Bearer anything' } }));
  assert.equal(result.status, 401);
  assert.equal(f.processed(), 0);
});

test('existing cron credential remains a fallback', async () => {
  const f = fixture({ CRON_SECRET: 'legacy-secret' });
  const result = await f.handlers.POST(new Request('https://example.com', { method: 'POST', headers: { authorization: 'Bearer legacy-secret' } }));
  assert.equal(result.status, 200);
});

test('worker failures return a retryable response without leaking provider details', async () => {
  const f = fixture({ CALL_ANALYSIS_CRON_SECRET: 'scheduler-secret' }, true);
  const result = await f.handlers.POST(new Request('https://example.com', { method: 'POST', headers: { authorization: 'Bearer scheduler-secret' } }));
  assert.equal(result.status, 500);
  assert.deepEqual(await result.json(), { ok: false, error: 'Call alerts could not be processed.' });
});
