import assert from "node:assert/strict";
import test from "node:test";
import {authFeedbackReducer as reduce,INITIAL_AUTH_FEEDBACK as initial} from "./auth-feedback-state";
test("a refreshed security token cannot dismiss a duplicate-account or rate-limit error",()=>{
 for(const message of ["An account with this email already exists.","Too many signups from this network."]){
  let state=reduce(initial,{type:"request-failed",message});
  state=reduce(state,{type:"security-failed",message:"Retry the security check."});
  state=reduce(state,{type:"security-ready"});
  state=reduce(state,{type:"security-ready"});
  assert.equal(state.error,message);assert.equal(state.securityError,null);
 }
});
test("security recovery clears only its own error, and explicit submission starts fresh",()=>{
 const failed=reduce(initial,{type:"security-failed",message:"Check unavailable"});
 assert.equal(reduce(failed,{type:"security-ready"}).securityError,null);
 const server=reduce(failed,{type:"request-failed",message:"Please try again."});
 assert.deepEqual(reduce(server,{type:"submit"}),initial);
});
