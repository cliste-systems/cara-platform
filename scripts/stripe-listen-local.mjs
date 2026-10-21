import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key || !key.includes("_test_")) throw new Error("Local webhook forwarding requires a Stripe test key.");
const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001");
if (!["localhost", "127.0.0.1"].includes(origin.hostname)) throw new Error("Local webhook forwarding requires a localhost app URL.");
const env = { ...process.env, STRIPE_API_KEY: key };

function capture(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("stripe", args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", data => { output += data; });
    child.stderr.on("data", data => { output += data; });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve(output) : reject(new Error("Stripe CLI could not prepare local webhook forwarding.")));
  });
}

const result = await capture(["listen", "--print-secret"]);
const secret = String(result).match(/whsec_[a-zA-Z0-9]+/)?.[0];
if (!secret) throw new Error("Stripe CLI did not return a signing secret.");
const path = new URL("../.env.local", import.meta.url);
let contents = await readFile(path, "utf8");
const line = `STRIPE_WEBHOOK_SECRET=${secret}`;
contents = /^STRIPE_WEBHOOK_SECRET=/m.test(contents)
  ? contents.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, line)
  : `${contents}\n${line}\n`;
await writeFile(path, contents);
const forward = new URL("/api/stripe/webhook", origin).href;
const child = spawn("stripe", ["listen", "--skip-update", "--events", "checkout.session.completed,checkout.session.async_payment_succeeded,setup_intent.succeeded,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed", "--forward-to", forward], { env, stdio: ["ignore", "pipe", "pipe"] });
const redact = data => process.stdout.write(String(data).replace(/whsec_[a-zA-Z0-9]+/g, "[signing secret configured]").replace(/(?:sk|rk|rkcs)_test_[a-zA-Z0-9]+/g, "[test key]"));
child.stdout.on("data", redact);
child.stderr.on("data", redact);
console.log(`Signed Stripe test webhooks forwarding to ${forward}`);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code || 0; });
