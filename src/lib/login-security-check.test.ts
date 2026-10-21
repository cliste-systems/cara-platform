import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

type Element = { type: unknown; props: Record<string, unknown> };
type Result = { ok: true } | { ok: false; message: string; requiresCaptcha: boolean };

// Exercise the actual component's event handlers with a deterministic widget and
// server action. No real credentials, Cloudflare challenges, or auth writes.
function fixture(results: (Result | Error)[]) {
  const slots: unknown[] = [];
  let cursor = 0;
  let tree: Element;
  let widgetSucceeded = false;
  let resets = 0;
  const submissions: { turnstileToken: string | null }[] = [];
  const timers: (() => void)[] = [];
  const navigations: string[] = [];
  const widget = { reset() { resets++; widgetSucceeded = false; } };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const imports: Record<string, unknown> = {
    react: {
      useRef(initial: unknown) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = { current: initial };
        return slots[index];
      },
      useState(initial: unknown) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [slots[index], (value: unknown) => {
          slots[index] = typeof value === "function" ? value(slots[index]) : value;
        }];
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "motion/react": { motion: { form: "form" }, useReducedMotion: () => true },
    "@marsidev/react-turnstile": { Turnstile: "Turnstile" },
    "@/lib/utils": { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") },
    "./actions": { passwordSignIn: async (payload: { turnstileToken: string | null }) => {
      submissions.push(payload);
      const result = results.shift();
      if (result instanceof Error) throw result;
      assert.ok(result, "Unexpected sign-in request");
      return result;
    } },
  };
  const filename = fileURLToPath(new URL("../app/login/login-form.tsx", import.meta.url));
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const isolatedModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: isolatedModule, exports: isolatedModule.exports,
    require(name: string) { return imports[name] ?? new Proxy({}, { get: (_target, key) => String(key) }); },
    process: { env: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-widget" } },
    window: { setTimeout(callback: () => void) { timers.push(callback); }, location: { assign(url: string) { navigations.push(url); } } },
  });
  const { LoginForm } = isolatedModule.exports as { LoginForm: (props: object) => Element };
  function elements(node: unknown): Element[] {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!node || typeof node !== "object" || !("props" in node)) return [];
    const element = node as Element;
    return [element, ...elements(element.props.children)];
  }
  function find(type: unknown, id?: string) {
    const element = elements(tree).find((item) => item.type === type && (!id || item.props.id === id || item.props.htmlFor === id));
    assert.ok(element, `Missing ${String(type)} ${id ?? ""}`);
    return element;
  }
  function render() {
    cursor = 0;
    tree = LoginForm({});
    const captcha = elements(tree).find((item) => item.type === "Turnstile");
    if (captcha?.props.ref) (captcha.props.ref as { current: unknown }).current = widget;
  }
  function change(id: string, value: string) {
    (find("input", id).props.onChange as (event: unknown) => void)({ target: { value } });
    render();
  }
  async function submit() {
    await (find("form").props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
    render();
  }
  function solve(token: string) {
    widgetSucceeded = true;
    (find("Turnstile").props.onSuccess as (token: string) => void)(token);
    render();
  }
  function widgetEvent(event: string) {
    (find("Turnstile").props[event] as () => void)();
    render();
  }
  render();
  change("login-email", "someone@example.invalid");
  change("login-password", "test-only-password");
  return { submit, solve, widgetEvent, find, submissions, navigations,
    securityError: () => elements(tree).find((item) => item.props.role === "alert")?.props.children,
    finishNavigation() { for (const timer of timers) timer(); },
    resets: () => resets, widgetSucceeded: () => widgetSucceeded,
  };
}

const denied: Result = { ok: false, message: "Incorrect details", requiresCaptcha: true };

test("failed verified sign-in resets the successful widget and accepts a fresh token without refresh", async () => {
  const f = fixture([denied, denied, { ok: true }]);
  await f.submit();
  f.solve("first-single-use-token");
  await f.submit();
  assert.equal(f.widgetSucceeded(), false, "must not leave the widget showing Success with no saved token");
  assert.equal(f.resets(), 1);
  f.solve("fresh-single-use-token");
  await f.submit();
  assert.deepEqual(f.submissions.map((item) => item.turnstileToken), [null, "first-single-use-token", "fresh-single-use-token"]);
  f.finishNavigation();
  assert.deepEqual(f.navigations, ["/auth/post-login"]);
});

test("a lost request resets possibly consumed verification before retrying", async () => {
  const f = fixture([denied, new Error("Connection lost"), { ok: true }]);
  await f.submit();
  f.solve("possibly-consumed-token");
  await f.submit();
  assert.equal(f.resets(), 1);
  assert.equal(f.widgetSucceeded(), false);
  f.solve("replacement-token");
  await f.submit();
  assert.equal(f.submissions[2].turnstileToken, "replacement-token");
});

for (const event of ["onExpire", "onTimeout", "onError"]) {
  test(`${event} prevents stale verification reuse and a new success clears the security error`, async () => {
    const f = fixture([denied, { ok: true }]);
    await f.submit();
    f.solve("old-token");
    f.widgetEvent(event);
    await f.submit();
    assert.equal(f.submissions.length, 1, "must not call sign-in without a valid security response");
    assert.equal(f.find("OnboardingFieldBox", "login-password").props.error, undefined);
    assert.match(String(f.securityError()), /complete the security check/i);
    f.solve("renewed-token");
    assert.equal(f.securityError(), undefined);
    await f.submit();
    assert.equal(f.submissions[1].turnstileToken, "renewed-token");
  });
}
