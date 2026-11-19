import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const PRIVATE_MODULES = new Set([
  "lib/compile-cara-prompt.ts",
  "lib/business-file-prompt.ts",
  "lib/cara-prompt-from-org.ts",
  "lib/platform-cara-rules.ts",
]);

/** Follow browser imports, including lazy imports and re-exports, without running application code. */
export function browserBoundaryViolations(sourceRoot: string): string[][] {
  const root = path.resolve(sourceRoot);
  const options: ts.CompilerOptions = {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
    baseUrl: root,
    paths: { "@/*": ["./*"] },
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
  };
  const modules = new Map<string, { client: boolean; action: boolean; private: boolean; imports: string[] }>();
  function walk(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(filename);
      else if (/\.[cm]?[jt]sx?$/.test(filename) && !/\.(test|spec|d)\.[cm]?[jt]sx?$/.test(filename)) {
        const source = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
        const directives = new Set<string>();
        for (const statement of source.statements) {
          if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
          directives.add(statement.expression.text);
        }
        const specs: string[] = [];
        function visit(node: ts.Node) {
          if (ts.isImportDeclaration(node)) {
            const clause = node.importClause;
            const bindings = clause?.namedBindings;
            const onlyTypes = clause?.isTypeOnly || (clause && !clause.name && bindings && ts.isNamedImports(bindings) &&
              bindings.elements.length > 0 && bindings.elements.every((item) => item.isTypeOnly));
            if (!onlyTypes && ts.isStringLiteral(node.moduleSpecifier)) specs.push(node.moduleSpecifier.text);
          } else if (ts.isExportDeclaration(node)) {
            const clause = node.exportClause;
            const onlyTypes = node.isTypeOnly || (clause && ts.isNamedExports(clause) &&
              clause.elements.length > 0 && clause.elements.every((item) => item.isTypeOnly));
            if (!onlyTypes && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specs.push(node.moduleSpecifier.text);
          } else if (ts.isCallExpression(node) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
            node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
            specs.push(node.arguments[0].text);
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
        const imports = specs.flatMap((specifier) => {
          if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return [];
          const resolved = ts.resolveModuleName(specifier, filename, options, ts.sys).resolvedModule?.resolvedFileName;
          return resolved && resolved.startsWith(`${root}${path.sep}`) ? [resolved] : [];
        });
        modules.set(filename, {
          client: directives.has("use client"), action: directives.has("use server"),
          private: specs.includes("server-only") || PRIVATE_MODULES.has(path.relative(root, filename).split(path.sep).join("/")),
          imports,
        });
      }
    }
  }
  walk(root);
  const violations: string[][] = [];
  for (const [entry, info] of modules) {
    if (!info.client) continue;
    const queue = [[entry]];
    const seen = new Set<string>();
    for (let i = 0; i < queue.length; i++) {
      const chain = queue[i];
      const current = chain[chain.length - 1];
      if (seen.has(current)) continue;
      seen.add(current);
      const module = modules.get(current);
      if (!module) continue;
      // Server actions cross as references; their implementations stay server-side.
      if (module.action) continue;
      if (module.private) {
        violations.push(chain.map((file) => path.relative(root, file)));
        continue;
      }
      for (const dependency of module.imports) queue.push([...chain, dependency]);
    }
  }
  return violations;
}
