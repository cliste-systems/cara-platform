import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
function load(environment:string) {
  const source=readFileSync(new URL("./onboarding-dev.ts",import.meta.url),"utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const mod={exports:{}};
  vm.runInNewContext(compiled,{module:mod,exports:mod.exports,require:()=>({}),process:{env:{NODE_ENV:environment,CLISTE_ONBOARDING_FREE_NAV:"true",CLISTE_SIGNUP_ONBOARDING_DEV:"true",CLISTE_ONBOARDING_PREVIEW:"true"}}});
  return mod.exports as typeof import("./onboarding-dev");
}
test("production ignores all local onboarding and signup bypass flags",()=>{const api=load("production");assert.equal(api.isOnboardingFreeNavEnabled(),false);assert.equal(api.isSignupOnboardingDevRelaxed(),false);assert.equal(api.isDevOnboardingPreviewEnabled(),false);assert.equal(api.enforceOnboardingStepOrder(),true);});
test("local preview flags remain explicitly opt-in during development",()=>{const api=load("development");assert.equal(api.isOnboardingFreeNavEnabled(),true);assert.equal(api.isSignupOnboardingDevRelaxed(),true);assert.equal(api.isDevOnboardingPreviewEnabled(),true);});
