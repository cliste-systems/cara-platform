import assert from "node:assert/strict";
import test from "node:test";
import { buildInviteEmailBodies } from "./invite-email-bodies";

const input = {
  actionLink: "https://app.hellocara.ie/auth/callback?token_hash=abc&type=invite",
  logoUrl: "https://app.hellocara.ie/m8x4p2n7.png",
  businessName: "Murphy’s SuperValu Killarney",
  productName: "Retail",
  organizationName: "Murphy Retail Group",
};

test("invitation explains password, agreements and dashboard in order", () => {
  const bodies = buildInviteEmailBodies({ ...input, recipientName: "Jane", billingMethod: "invoice" });
  assert.match(bodies.subject, /Set up your account for Murphy/);
  assert.match(bodies.text, /Hi Jane,/);
  assert.ok(bodies.text.indexOf("Choose your password") < bodies.text.indexOf("Review and accept"));
  assert.ok(bodies.text.indexOf("Review and accept") < bodies.text.indexOf("Open your store dashboard"));
  assert.match(bodies.text, /Organisation: Murphy Retail Group/);
  assert.match(bodies.text, /No card details are needed/);
  assert.match(bodies.html, /Set up my account/);
  assert.ok(bodies.text.includes(input.actionLink));
});

test("existing-user invitation never tells the user to replace their password", () => {
  const bodies = buildInviteEmailBodies({ ...input, requiresPassword: false });
  assert.match(bodies.text, /Sign in securely/);
  assert.doesNotMatch(bodies.text, /Choose your password|No card details/);
  assert.match(bodies.html, /Open my invitation/);
});

test("invitation escapes untrusted names, titles and links in HTML", () => {
  const bodies = buildInviteEmailBodies({ ...input, recipientName: '<img src=x onerror="alert(1)">', businessName: '<script>bad()</script>', organizationName: 'A & B "Group"' });
  assert.doesNotMatch(bodies.html, /<script>|<img src=x/);
  assert.match(bodies.html, /&lt;script&gt;/);
  assert.match(bodies.html, /A &amp; B &quot;Group&quot;/);
  assert.match(bodies.html, /token_hash=abc&amp;type=invite/);
});

test("invitation carries accessible email structure and support guidance", () => {
  const bodies = buildInviteEmailBodies(input);
  assert.match(bodies.html, /<html lang="en" dir="ltr">/);
  assert.match(bodies.html, /<table lang="en" dir="ltr" role="presentation"/);
  assert.equal((bodies.html.match(/<h1/g) ?? []).length, 1);
  assert.match(bodies.html, /Contact HelloCara Support/);
  assert.match(bodies.text, /single-use/);
  assert.match(bodies.text, /expired/);
});


test("invitation renders the supplied logo and HelloCara charcoal brand without a green CTA", () => {
  const bodies = buildInviteEmailBodies({ ...input, logoUrl: "cid:hellocara-logo" });
  assert.match(bodies.html, /src="cid:hellocara-logo"/);
  assert.match(bodies.html, /alt="HelloCara logo"/);
  assert.match(bodies.html, /background:#353d42/);
  assert.doesNotMatch(bodies.html, /#244936|Your store workspace/);
});
