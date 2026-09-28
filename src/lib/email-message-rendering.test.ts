import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEmailFrameDocument,
  emailContentHeight,
  emailHasExternalImages,
} from "./email-message-rendering";

test("email images stay blocked until explicitly enabled, including CSS backgrounds and srcset", () => {
  const html =
    '<html><head><style>.hero {background:url(https://images.example/hero.png)}</style></head><body><img width="600" height="400" src="https://images.example/hero.png" alt="Welcome &amp; hello"><img src="data:image/png;base64,abc" srcset="https://images.example/a.png 2x"><img src="https://images.example/pixel.gif" width="1" height="1"></body></html>';
  assert.equal(emailHasExternalImages(html), true);
  const blocked = buildEmailFrameDocument(html);
  assert.doesNotMatch(blocked, /https:\/\/images\.example/);
  assert.match(blocked, /Welcome &amp; hello/);
  assert.doesNotMatch(blocked, /width="600"|height="400"/);
  assert.match(blocked, /img-src data: blob:;/);
  const allowed = buildEmailFrameDocument(html, { allowExternalImages: true });
  assert.match(allowed, /https:\/\/images\.example\/hero\.png/);
  assert.match(allowed, /img-src data: blob: https:;/);
});

test("the email cannot supply navigation metadata or executable scripts", () => {
  const html =
    '<html><head><base href="https://untrusted.example/"><meta content="0; url=https://untrusted.example/" http-equiv="refresh"><script>alert(1)</script></head><body>Message</body></html>';
  const output = buildEmailFrameDocument(html);
  assert.doesNotMatch(
    output,
    /untrusted\.example|<script|http-equiv="refresh"/,
  );
  assert.match(output, /default-src 'none'/);
  assert.match(output, /form-action 'none'/);
  assert.match(output, /base-uri 'none'/);
  assert.ok(
    output.indexOf("Content-Security-Policy") < output.indexOf("<body>"),
  );
});

test("viewing outbound mail does not trigger our open tracking pixel even when images are shown", () => {
  const html =
    '<p>Hello</p><img src="https://example.com/api/hellocara-email-open?token=secret"><img src="https://example.com/logo.png">';
  const output = buildEmailFrameDocument(html, {
    allowExternalImages: true,
    stripOpenTrackingPixel: true,
  });
  assert.doesNotMatch(output, /hellocara-email-open/);
  assert.match(output, /logo\.png/);
});

test("blocked image alt text cannot introduce markup", () => {
  const output = buildEmailFrameDocument(
    '<img src="https://example.com/image.png" alt="&lt;script&gt;hello&lt;/script&gt;">',
  );
  assert.match(output, /&lt;script&gt;hello&lt;\/script&gt;/);
  assert.doesNotMatch(output, /<script>/);
});

test("long emails retain their entire intrinsic height and short ones can shrink", () => {
  const body = (height: number) => ({
    scrollHeight: height,
    offsetHeight: height,
    getBoundingClientRect: () => ({ height }) as DOMRect,
  });
  assert.equal(emailContentHeight(body(24000)), 24001);
  assert.equal(emailContentHeight(body(180)), 181);
  assert.equal(emailContentHeight(body(0)), 80);
  assert.doesNotMatch(
    buildEmailFrameDocument("<p>Hello</p>"),
    /min-height:100%/,
  );
});

test("the frame CSP precedes even malformed sender documents", () => {
  const output = buildEmailFrameDocument(
    '<img src="https://example.com/image.png"><html><head><style>body{font-size:16px}</style></head><body>Message</body></html>',
    { allowExternalImages: true },
  );
  assert.ok(output.indexOf("Content-Security-Policy") < output.indexOf("<img"));
  assert.equal((output.match(/<html>/g) ?? []).length, 1);
  assert.match(output, /body\{font-size:16px\}/);
});
