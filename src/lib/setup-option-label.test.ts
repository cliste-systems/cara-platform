import assert from "node:assert/strict";
import test from "node:test";
import {setupOptionLabel} from "./setup-option-label";
test("labels the saved self-service and assisted setup choices",()=>{assert.equal(setupOptionLabel("diy"),"Self-service");assert.equal(setupOptionLabel("remote"),"Remote setup");for(const tier of ["onsite","onsite_dublin","onsite_other"])assert.equal(setupOptionLabel(tier),"In-person setup");});
test("an absent or unknown choice is not shown as a self-service selection",()=>{for(const tier of [null,undefined,"","unknown"])assert.equal(setupOptionLabel(tier),"Not selected");});
