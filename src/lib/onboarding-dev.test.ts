import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
function load(environment:string) {
  const source=readFileSync(new URL("./onboarding-dev.ts",import.meta.url),"utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const mod={exports:{}};
  vm.runInNewContext(compiled,{module:mod,exports:mod.exports,require:()=>({}),URL,process:{env:{NODE_ENV:environment,CLISTE_ONBOARDING_FREE_NAV:"true",CLISTE_SIGNUP_ONBOARDING_DEV:"true",CLISTE_ONBOARDING_PREVIEW:"true",CLISTE_LOCAL_SIGNUP_CODES:"true",CLISTE_LOCAL_SETUP_TESTS:"true"}}});
  return mod.exports as typeof import("./onboarding-dev");
}
test("production ignores all local onboarding and signup bypass flags",()=>{const api=load("production");assert.equal(api.isOnboardingFreeNavEnabled(),false);assert.equal(api.isSignupOnboardingDevRelaxed(),false);assert.equal(api.isDevOnboardingPreviewEnabled(),false);assert.equal(api.enforceOnboardingStepOrder(),true);});
test("local preview flags remain explicitly opt-in during development",()=>{const api=load("development");assert.equal(api.isOnboardingFreeNavEnabled(),true);assert.equal(api.isSignupOnboardingDevRelaxed(),true);assert.equal(api.isDevOnboardingPreviewEnabled(),true);});

test("dummy codes require development and a loopback host with matching origin",()=>{
 const local=new Headers({host:"localhost:3001",origin:"http://localhost:3001"});
 assert.equal(load("development").isLocalSignupCodePreview(local),true);
 assert.equal(load("production").isLocalSignupCodePreview(local),false);
 assert.equal(load("test").isLocalSignupCodePreview(local),false);
 assert.equal(load("development").isLocalSignupCodePreview(new Headers({host:"app.hellocara.ie"})),false);
 assert.equal(load("development").isLocalSignupCodePreview(new Headers({host:"localhost:3001",origin:"https://attacker.invalid"})),false);
});

test("phone rehearsal is restricted to development on loopback, even with its flag set",()=>{
 const local=new Headers({host:"localhost:3001",origin:"http://localhost:3001"});
 assert.equal(load("development").isLocalSetupTestEnabled(local),true);
 for(const environment of ["production","test"])assert.equal(load(environment).isLocalSetupTestEnabled(local),false);
 assert.equal(load("development").isLocalSetupTestEnabled(new Headers({host:"app.hellocara.ie"})),false);
 assert.equal(load("development").isLocalSetupTestEnabled(new Headers({host:"localhost:3001",origin:"https://attacker.invalid"})),false);
});
