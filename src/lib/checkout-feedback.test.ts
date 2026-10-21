import assert from "node:assert/strict";
import test from "node:test";
import {checkoutFeedback} from "./checkout-feedback";
test("declines give a clear recovery action without exposing issuer internals",()=>{const f=checkoutFeedback("confirmation",{code:"card_declined",message:"raw issuer detail"});assert.equal(f.title,"Your card wasn’t accepted");assert.match(f.message,/another card/);assert.doesNotMatch(f.message,/raw issuer/);});
test("a saved card retries workspace setup instead of asking for payment again",()=>{const f=checkoutFeedback("workspace");assert.equal(f.title,"Your card is saved");assert.equal(f.retryLabel,"Finish setting up");});
test("unknown Stripe errors do not expose internal server messages",()=>{const f=checkoutFeedback("confirmation",{type:"api_error",message:"private upstream detail"});assert.doesNotMatch(f.message,/private/);assert.match(f.title,/connect/);});
test("field validation retains actionable Stripe field feedback",()=>{assert.equal(checkoutFeedback("details",{message:"Your card number is incomplete."}).message,"Your card number is incomplete.");});
