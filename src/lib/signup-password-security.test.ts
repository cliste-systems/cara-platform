import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {checkSignupPassword} from "./signup-password-security";

test("breached password is rejected using only its five-character hash prefix", async()=>{
 const original=global.fetch;const password="fixture-only-password";const hash=createHash("sha1").update(password).digest("hex").toUpperCase();
 global.fetch=async(input,init)=>{assert.equal(String(input),`https://api.pwnedpasswords.com/range/${hash.slice(0,5)}`);assert.equal(init?.body,undefined);return new Response(`${hash.slice(5)}:10`);};
 try{assert.equal((await checkSignupPassword(password)).ok,false);}finally{global.fetch=original;}
});
test("password lookup fails closed on outages or malformed responses",async()=>{
 const original=global.fetch;
 try {for(const response of [new Response("error",{status:503}),new Response("unexpected")]){global.fetch=async()=>response;assert.equal((await checkSignupPassword("fixture")).ok,false);}}
 finally{global.fetch=original;}
});
test("padding results with count zero are not treated as a breach",async()=>{
 const original=global.fetch;const password="fixture";const hash=createHash("sha1").update(password).digest("hex").toUpperCase();global.fetch=async()=>new Response(`${hash.slice(5)}:0`);
 try{assert.equal((await checkSignupPassword(password)).ok,true);}finally{global.fetch=original;}
});
