// Diagnose existing failures separately; the original full CI remains unchanged.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const sha = process.env.BASE_SHA;
if (!/^[0-9a-f]{40}$/.test(sha ?? '')) throw new Error('A validated base commit is required.');
const base = join(mkdtempSync(join(tmpdir(), 'engineer-metrics-')), 'base');
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}
const worktree = run('git', ['worktree', 'add', '--detach', base, sha], root);
if (worktree.status !== 0) throw new Error(worktree.output);
symlinkSync(join(root, 'node_modules'), join(base, 'node_modules'), 'dir');
const diagnostics = {};
try {
  for (const [label, cwd] of [['base', base], ['head', root]]) {
    const suite = run('npm', ['test'], cwd);
    const types = run('node', [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--pretty', 'false', '--incremental', 'false'], cwd);
    writeFileSync(join(root, `metrics-${label}-suite.log`), suite.output);
    writeFileSync(join(root, `metrics-${label}-types.log`), types.output);
    const rawErrors = types.output.split('\n').filter(line => /error TS\d+/.test(line));
    diagnostics[label] = {
      suiteExit: suite.status,
      typecheckExit: types.status,
      tests: suite.output.split('\n').filter(line => /^# (tests|pass|fail|skipped) /.test(line)),
      failures: [...suite.output.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(match => match[1].replaceAll(base, '<repo>').replaceAll(root, '<repo>')),
      typeErrors: rawErrors.map(line => line.replace(/\(\d+,\d+\)/g, '(line)').replaceAll(base, '<repo>').replaceAll(root, '<repo>')),
    };
    if (label === 'head') {
      for (const error of rawErrors) {
        const match = error.match(/^(src\/[^\n]+)\((\d+),(\d+)\): error TS2589/);
        if (!match) continue;
        const source = readFileSync(join(cwd, match[1]), 'utf8');
        const line = Number(match[2]);
        console.log('EXACT TYPE DIAGNOSTIC', JSON.stringify({
          error, file: match[1], sha256: createHash('sha256').update(source).digest('hex'),
          context: source.split('\n').slice(Math.max(0, line - 4), line + 3).map((text, index) => `${Math.max(1, line - 3) + index}: ${text}`),
          checkout: run('git', ['rev-parse', 'HEAD'], cwd).output.trim(),
        }, null, 2));
      }
    }
  }
  const addedFailures = diagnostics.head.failures.filter(value => !diagnostics.base.failures.includes(value));
  const addedTypes = diagnostics.head.typeErrors.filter(value => !diagnostics.base.typeErrors.includes(value));
  console.log(JSON.stringify({ baseSha: sha, ...diagnostics, addedFailures, addedTypes }, null, 2));
  // A crashed runner with no parsable diagnostics is not a successful comparison.
  const unexplained = Object.values(diagnostics).some(result =>
    (result.suiteExit !== 0 && result.failures.length === 0) ||
    (result.typecheckExit !== 0 && result.typeErrors.length === 0));
  if (unexplained || addedFailures.length || addedTypes.length) process.exitCode = 1;
} finally {
  run('git', ['worktree', 'remove', '--force', base], root);
}
