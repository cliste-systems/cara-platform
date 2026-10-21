import test from "node:test";
import assert from "node:assert/strict";
import { parseAdminCallDirectoryFilters } from "./admin-call-directory-filters";
test("operational drill-down filters keep failures, reviews and processing separate", () => {
 const failure = parseAdminCallDirectoryFilters({date:"today",outcome:"failed"});
 assert.equal(failure.outcome,"failed"); assert.equal(failure.status,"all"); assert.equal(failure.date,"today");
 const review = parseAdminCallDirectoryFilters({status:"fail"}); assert.equal(review.outcome,"all"); assert.equal(review.status,"fail");
 assert.equal(parseAdminCallDirectoryFilters({processing:"issues"}).processing,true);
 assert.equal(parseAdminCallDirectoryFilters({status:"backlog"}).status,"backlog");
});
test("invalid URL filters cannot expand date or paging scope", () => {
 const parsed = parseAdminCallDirectoryFilters({page:"Infinity",status:"unknown",customer:"invalid",kind:"invalid",date:"yesterday",q:" x ".repeat(100)});
 assert.equal(parsed.page,0); assert.equal(parsed.status,"all"); assert.equal(parsed.customer,""); assert.equal(parsed.kind,"all"); assert.equal(parsed.date,"all"); assert.ok(parsed.query.length<=200);
 assert.equal(parseAdminCallDirectoryFilters({page:"-10"}).page,0);
 assert.equal(parseAdminCallDirectoryFilters({page:"1.9"}).page,1);
});
