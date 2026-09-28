import assert from "node:assert/strict";
import test from "node:test";
import { validateLegalAgreementInput } from "./legal-agreement-input";
import { missingCurrentLegalDocuments } from "./legal-acceptance-query";
import { LEGAL_DOCUMENT_VERSIONS, requiredLegalDocuments } from "./legal-documents";

function validForm() {
  const form = new FormData();
  form.set("authority", "on"); form.set("signatory_name", "Pat Test"); form.set("signatory_role", "Director");
  for (const doc of requiredLegalDocuments(true)) {
    form.set(`accept_${doc}`, "on"); form.set(`version_${doc}`, LEGAL_DOCUMENT_VERSIONS[doc]);
  }
  return form;
}
test("dashboard always requires DPA before data access", () => assert.deepEqual(requiredLegalDocuments(false), ["terms", "privacy", "dpa"]));
test("unchecked authority or document cannot be submitted", () => {
  const form = validForm(); form.delete("authority"); assert.match(validateLegalAgreementInput(form, ["terms"])!, /authorised/);
  form.set("authority", "on"); form.delete("accept_dpa"); assert.match(validateLegalAgreementInput(form, ["terms", "dpa"])!, /required/);
});
test("reject stale documents and incomplete signatory details", () => {
  const form = validForm(); form.set("version_terms", "2026-06-12"); assert.match(validateLegalAgreementInput(form, ["terms"])!, /changed/);
  form.set("signatory_role", " "); assert.match(validateLegalAgreementInput(form, ["terms"])!, /role/);
});
test("current explicitly checked agreements pass", () => assert.equal(validateLegalAgreementInput(validForm(), requiredLegalDocuments(true)), null));
test("old acceptance versions cannot unlock dashboard", () => assert.deepEqual(missingCurrentLegalDocuments([
  { document_type: "terms", document_version: "2026-06-12" },
  { document_type: "privacy", document_version: LEGAL_DOCUMENT_VERSIONS.privacy },
  { document_type: "dpa", document_version: LEGAL_DOCUMENT_VERSIONS.dpa },
]), ["terms"]));
