import assert from "node:assert/strict";
import test from "node:test";
import { signupDetails, usesSimpleSignup, PUBLIC_SIGNUP_FLOW } from "./public-signup-flow";

test("only server-owned metadata selects the simplified journey", () => {
  assert.equal(usesSimpleSignup({app_metadata:{cliste_signup_flow:PUBLIC_SIGNUP_FLOW}}),true);
  assert.equal(usesSimpleSignup({app_metadata:{}}),false);
  assert.equal(usesSimpleSignup({app_metadata:{cliste_signup_source:"managed"}}),false);
});
test("basic signup accepts a full name without collecting services, phone, or niche",()=>{
  const form=new FormData();form.set("fullName","  Alex O’Neill  ");form.set("businessName","Alex Plumbing");
  assert.deepEqual(signupDetails(form),{firstName:"Alex",lastName:"O’Neill",ownerName:"Alex O’Neill",businessName:"Alex Plumbing"});
});
test("names are not required to contain multiple words",()=>{
  const form=new FormData();form.set("fullName","Alex");form.set("businessName","Alex Services");
  assert.equal(signupDetails(form).ownerName,"Alex");
});
test("older forms remain compatible during rollout",()=>{
  const form=new FormData();form.set("firstName","Alex");form.set("lastName","Smith");form.set("salonName","Legacy business");
  assert.equal(signupDetails(form).ownerName,"Alex Smith");assert.equal(signupDetails(form).businessName,"Legacy business");
});
