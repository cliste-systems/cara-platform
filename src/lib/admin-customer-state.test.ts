import test from "node:test";
import assert from "node:assert/strict";
import { customerNextAction, customerPlanLabel, isTestCustomer, resolveCustomerOwner } from "./admin-customer-state";
test("self-service ownership comes from current account membership, not an invitation",()=>{
 assert.equal(resolveCustomerOwner([{user_id:"signup-user",role:"admin"}]),"signup-user");
 assert.equal(resolveCustomerOwner([{user_id:"current",role:"owner"}],"old-invite"),"current");
 assert.equal(resolveCustomerOwner([{user_id:"reader",role:"member"}],"removed-user"),null);
 assert.equal(resolveCustomerOwner([],"old-invite"),null);
});
test("public plan names match the agreed pricing tiers",()=>{
 assert.equal(customerPlanLabel("pro"),"Growth");assert.equal(customerPlanLabel(null),"Not selected");assert.equal(customerPlanLabel("not-a-plan"),"Not selected");
});
test("test record filtering uses explicit markers, not a customer name guess",()=>{
 assert.equal(isTestCustomer({name:"[smoke test] Plumbing"}),true);
 assert.equal(isTestCustomer({name:"Plumbing",slug:"smoke-test-plumbing"}),true);
 assert.equal(isTestCustomer({name:"Test Engineering Limited"}),false);
});
test("active billing never means Cara is answering calls",()=>{
 const row={isActive:false,accountStatus:"active",phoneNumber:null,planTier:"pro",provisionSource:"self_serve"};
 assert.equal(customerNextAction(row),"Assign phone number");
 assert.equal(customerNextAction({...row,phoneNumber:"+3531234567"}),"Review launch checklist");
 assert.equal(customerNextAction({...row,isActive:true}),"View activity");
 assert.equal(customerNextAction({...row,accountStatus:"past_due",isActive:true}),"Review billing");
});
