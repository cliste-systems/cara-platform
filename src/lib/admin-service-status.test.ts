import assert from "node:assert/strict";
import { test } from "node:test";
import { parseServiceStatus, SERVICE_PROVIDERS } from "./admin-service-status";
test("missing or unexpected feed never reports healthy",()=>{for(const input of [null,{},"<html>",{components:[{name:"API",status:"unexpected"}]}]) assert.equal(parseServiceStatus(input).state,"unknown");});
test("active incident overrides operational components",()=>assert.equal(parseServiceStatus({components:[{name:"API",status:"operational"}],incidents:[{name:"API latency",status:"monitoring"}]}).state,"degraded"));
test("Datadog groups and resolved incidents are parsed",()=>assert.equal(parseServiceStatus({components:[{components:[{name:"API",status:"operational"}]}],incidents:[{title:"Past issue",resolved:true,currentStatus:"resolved"}]}).state,"operational"));
test("outages and maintenance stay distinct",()=>{assert.equal(parseServiceStatus({components:[{name:"API",status:"major_outage"}]}).state,"outage");assert.equal(parseServiceStatus({components:[{name:"API",status:"under_maintenance"}]}).state,"maintenance");});

test("Statuspage group ID references do not become unknown components",()=>assert.equal(parseServiceStatus({status:{indicator:"none"},components:[{name:"Regions",status:"operational",components:["region-a"]},{id:"region-a",name:"Dublin",status:"operational"}]}).state,"operational"));
test("Twilio Australian MMS and Brazil SMS cannot affect Irish voice status",()=>{
  const result=parseServiceStatus({status:{indicator:"major"},components:[{id:"ie",name:"SIP Interface IE1",status:"operational"},{id:"au",name:"MMS, APAC",status:"major_outage"}],incidents:[{name:"MMS Delivery Failures Australia",status:"investigating",components:[{id:"au",name:"MMS, APAC"}]},{name:"SMS Delays Brazil",status:"investigating",components:[{name:"SMS"}]}]},"Twilio");
  assert.equal(result.state,"operational"); assert.deepEqual(result.details,[]);
});
test("Irish SIP incident is still surfaced",()=>{
 const result=parseServiceStatus({components:[{id:"ie",name:"SIP Interface IE1",status:"operational"}],incidents:[{name:"Irish SIP failures",status:"monitoring",components:[{id:"ie"}]}]},"Twilio"); assert.equal(result.state,"degraded");
});
test("Cloudflare WARP and foreign regional incidents do not affect DNS and Turnstile",()=>assert.equal(parseServiceStatus({status:{indicator:"minor"},components:[{id:"dns",name:"Authoritative DNS",status:"operational"},{id:"warp",name:"WARP",status:"degraded_performance"}],incidents:[{name:"WARP issue",status:"investigating",components:[{id:"warp"}]}]},"Cloudflare").state,"operational"));
test("OpenAI excludes ChatGPT and includes API failures",()=>{
 assert.equal(parseServiceStatus({components:[{name:"Realtime",status:"operational"},{name:"Conversations",status:"major_outage"}]},"OpenAI").state,"operational");
 assert.equal(parseServiceStatus({components:[{name:"Responses",status:"major_outage"}]},"OpenAI").state,"outage");
});
test("missing relevant components stays unknown",()=>assert.equal(parseServiceStatus({components:[{name:"MMS, APAC",status:"operational"}]},"Twilio").state,"unknown"));
test("Supabase ignores other compute regions",()=>assert.equal(parseServiceStatus({components:[{name:"eu-central-1",status:"operational"},{name:"us-east-1",status:"major_outage"}]},"Supabase").state,"operational"));

test("monitor only the confirmed active stack",()=>assert.deepEqual(SERVICE_PROVIDERS.map(([name])=>name),["Supabase","Vercel","LiveKit","Twilio","OpenAI","Stripe","Resend","Cloudflare"]));
