import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function fixture(local:boolean,userEmail='smoke@example.com',confirmed=true){
 let otpCalls=0;
 const testModule={exports:{}};
 const imports:Record<string,unknown>={
  'next/headers':{headers:async()=>new Headers({host:local?'localhost:3001':'app.hellocara.ie'})},
  '@/lib/onboarding-dev':{isLocalSignupCodePreview:()=>local,isSignupOnboardingDevRelaxed:()=>false},
  '@/lib/auth-rate-limit':{getRateLimitStatus:async()=>({allowed:true}),hashRateLimitIdentifier:(s:string)=>s,rateLimitFingerprint:()=>'',recordRateLimitFailure:async()=>{}},
  '@/lib/signup-email-otp':{SIGNUP_EMAIL_OTP_LENGTH:8,SIGNUP_EMAIL_OTP_PATTERN:/^\d{8}$/},
  '@/utils/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{email:userEmail,email_confirmed_at:confirmed?'fixture':null,app_metadata:{cliste_signup_source:'self_serve'}}},error:null}),verifyOtp:async()=>{otpCalls++;return {error:{message:'invalid'}};}}})},
 };
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/signup/verify-code.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:testModule,exports:testModule.exports,require:(name:string)=>imports[name]});
 return {verify:(testModule.exports as {verifySignupCode:(email:string,code:string)=>Promise<{ok:boolean}>}).verifySignupCode,otpCalls:()=>otpCalls};
}
test('local dummy code advances only the matching confirmed signed-in signup',async()=>{const f=fixture(true);assert.equal((await f.verify('smoke@example.com','123')).ok,true);assert.equal(f.otpCalls(),0);});
test('dummy code cannot confirm another email or an unconfirmed account',async()=>{for(const f of [fixture(true,'another@example.com'),fixture(true,'smoke@example.com',false)]){assert.equal((await f.verify('smoke@example.com','123')).ok,false);assert.equal(f.otpCalls(),0);}});
test('public verification still sends an exact-length code to Supabase',async()=>{const f=fixture(false);assert.equal((await f.verify('smoke@example.com','123')).ok,false);assert.equal(f.otpCalls(),0);assert.equal((await f.verify('smoke@example.com','12345678')).ok,false);assert.equal(f.otpCalls(),2);});
