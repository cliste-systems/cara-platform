import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const dashboardRepo = process.cwd();
const workerRepo = resolve(dashboardRepo, "../cara-voice-platform");
const repos = [
  { name: "dashboard", dir: dashboardRepo },
  { name: "worker", dir: workerRepo },
];

function run(dir, args, options = {}) {
  return spawnSync("git", args, {
    cwd: dir,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
}

function branchName(dir) {
  return run(dir, ["branch", "--show-current"]).stdout.trim();
}

function isClean(dir) {
  return run(dir, ["status", "--porcelain"]).stdout.trim().length === 0;
}

function aheadBehind(dir) {
  const result = run(dir, [
    "rev-list",
    "--left-right",
    "--count",
    "HEAD...origin/local-dev",
  ]);
  if (result.status !== 0) return null;

  const [aheadRaw, behindRaw] = result.stdout.trim().split(/\s+/);
  const ahead = Number(aheadRaw);
  const behind = Number(behindRaw);
  if (!Number.isFinite(ahead) || !Number.isFinite(behind)) return null;

  return { ahead, behind };
}

function autoStash(dir, repoName) {
  const stash = run(dir, [
    "stash",
    "push",
    "-u",
    "-m",
    "[local-sync] auto-stash before local-dev update",
  ]);

  if (stash.status !== 0) {
    console.error(
      `[local-sync] ${repoName} could not auto-stash local changes: ${stash.stderr.trim()}`,
    );
    return false;
  }

  console.log(
    `[local-sync] ${repoName} temporarily stashed local changes so local-dev can update.`,
  );
  return true;
}

function restoreAutoStash(dir, repoName) {
  const pop = run(dir, ["stash", "pop"]);
  if (pop.status === 0) {
    console.log(
      `[local-sync] Restored ${repoName} local changes after updating local-dev.`,
    );
    return true;
  }

  // git stash pop keeps the stash when it cannot apply cleanly. Clear any
  // conflict state so the dev server is not started from a half-merged tree;
  // the original edits remain recoverable in the stash.
  run(dir, ["reset", "--hard", "HEAD"]);
  console.error(
    `[local-sync] ${repoName} local changes conflicted with the new local-dev. They are still safe in the auto-stash; not starting from a conflicted worktree.`,
  );
  return false;
}

function syncRepo(repo) {
  if (!existsSync(repo.dir)) {
    console.error(`[local-sync] Missing ${repo.name} repo at ${repo.dir}`);
    return false;
  }

  const branch = branchName(repo.dir);
  if (branch !== "local-dev") {
    console.error(
      `[local-sync] ${repo.name} is on "${branch || "detached"}", not "local-dev". Skipping auto-sync.`,
    );
    return false;
  }

  const fetch = run(repo.dir, ["fetch", "origin", "local-dev"]);
  if (fetch.status !== 0) {
    console.error(`[local-sync] ${repo.name} fetch failed: ${fetch.stderr.trim()}`);
    return false;
  }

  const divergence = aheadBehind(repo.dir);
  if (!divergence) {
    console.error(
      `[local-sync] ${repo.name} could not determine local-dev divergence.`,
    );
    return false;
  }

  if (divergence.behind === 0) {
    return true;
  }

  // Never guess how to rewrite real local commits. Ordinary uncommitted
  // changes are auto-stashed below, but divergent commits require an explicit
  // merge/rebase decision so no work is silently changed.
  if (divergence.ahead > 0) {
    console.warn(
      `[local-sync] ${repo.name} has ${divergence.ahead} local commit(s) and is ${divergence.behind} commit(s) behind origin/local-dev. Auto-sync will not rewrite committed work.`,
    );
    return false;
  }

  const hadLocalChanges = !isClean(repo.dir);
  if (hadLocalChanges && !autoStash(repo.dir, repo.name)) {
    return false;
  }

  const merge = run(repo.dir, ["merge", "--ff-only", "origin/local-dev"]);
  if (merge.status !== 0) {
    console.error(
      `[local-sync] ${repo.name} could not fast-forward: ${merge.stderr.trim()}`,
    );
    if (hadLocalChanges) restoreAutoStash(repo.dir, repo.name);
    return false;
  }

  const remote = run(repo.dir, ["rev-parse", "origin/local-dev"]).stdout.trim();
  console.log(`[local-sync] Updated ${repo.name} to ${remote.slice(0, 8)}`);

  if (hadLocalChanges) {
    return restoreAutoStash(repo.dir, repo.name);
  }

  return true;
}

const initialSyncOk = repos.map((repo) => syncRepo(repo)).every(Boolean);
if (!initialSyncOk) {
  console.error(
    "[local-sync] Initial sync needs attention. Fix the issue above, then run npm run dev:local again.",
  );
  process.exit(1);
}

const child = spawn("npm", ["run", "dev:text-rehearsal"], {
  cwd: dashboardRepo,
  stdio: "inherit",
  env: process.env,
});

const timer = setInterval(() => {
  for (const repo of repos) syncRepo(repo);
}, 5000);

function shutdown(signal) {
  clearInterval(timer);
  if (!child.killed) child.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code, signal) => {
  clearInterval(timer);
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
