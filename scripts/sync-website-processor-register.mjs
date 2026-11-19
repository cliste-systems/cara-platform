import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const website = args.find((arg) => !arg.startsWith("--")) || "../cliste-systems-website";
const canonical = await readFile(resolve(app, "src/lib/sub-processors.data.ts"), "utf8");
const target = resolve(app, website, "lib/sub-processors.data.ts");

if (args.includes("--check")) {
  if (await readFile(target, "utf8") !== canonical) {
    throw new Error("The website processor register differs from the dashboard register.");
  }
} else {
  await writeFile(target, canonical);
}
