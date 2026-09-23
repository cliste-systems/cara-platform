/**
 * Point LiveKit Cloud voice webhooks at your local dashboard for the Garreth demo.
 *
 * Prerequisites:
 *   1. npm run dev -- -p 3001   (in another terminal)
 *   2. ngrok http 3001          (in another terminal)
 *
 * Then:
 *   npx tsx scripts/prep-kavanaghs-live-demo-tunnel.ts --ngrok-url https://xxxx.ngrok-free.app
 *   npx tsx scripts/prep-kavanaghs-live-demo-tunnel.ts --restore
 */

import { execSync } from "node:child_process";

const PRODUCTION_APP_URL = "https://app.hellocara.ie";
const LIVEKIT_AGENT_DIR =
  process.env.CLISTE_VOICE_WORKER_DIR?.trim() ||
  `${process.env.HOME}/cliste-code-base-2`;

function parseNgrokUrl(): string | null {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ngrok-url" && args[i + 1]) {
      return args[++i]!.replace(/\/$/, "");
    }
  }
  return null;
}

function runLkSecret(url: string): void {
  execSync(
    `lk agent update-secrets --secrets "CLISTE_APP_URL=${url}" --ignore-empty-secrets -y`,
    { stdio: "inherit", cwd: LIVEKIT_AGENT_DIR },
  );
}

function restore(): void {
  console.log(`Restoring LiveKit CLISTE_APP_URL → ${PRODUCTION_APP_URL}`);
  runLkSecret(PRODUCTION_APP_URL);
  console.log("\n✓ Restored. Agent restart may take ~1 minute.");
}

function setTunnel(ngrokUrl: string): void {
  if (!/^https:\/\/.+/i.test(ngrokUrl)) {
    throw new Error("ngrok URL must start with https://");
  }
  console.log(`Setting LiveKit CLISTE_APP_URL → ${ngrokUrl}`);
  runLkSecret(ngrokUrl);
  console.log("\n✓ Tunnel configured.");
  console.log("  Live calls to +353749759508 will POST webhooks to your local dashboard.");
  console.log("  Dashboard: http://localhost:3001/dashboard (kavanaghs@cliste.test)");
  console.log(
    `\n  After the demo: npx tsx scripts/prep-kavanaghs-live-demo-tunnel.ts --restore`,
  );
}

function main(): void {
  if (process.argv.includes("--restore")) {
    restore();
    return;
  }

  const ngrokUrl = parseNgrokUrl();
  if (!ngrokUrl) {
    console.log("Kavanaghs live demo — webhook tunnel setup\n");
    console.log("For live Action Inbox tickets during phone calls, tunnel webhooks locally:\n");
    console.log("  Terminal 1: cd cliste-code-base-1 && npm run dev -- -p 3001");
    console.log("  Terminal 2: ngrok http 3001");
    console.log(
      "  Terminal 3: npx tsx scripts/prep-kavanaghs-live-demo-tunnel.ts --ngrok-url https://YOUR.ngrok-free.app\n",
    );
    console.log(`LiveKit worker repo: ${LIVEKIT_AGENT_DIR}`);
    process.exit(0);
  }

  setTunnel(ngrokUrl);
}

main();
