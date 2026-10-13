import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = process.cwd();
const nativeRequire = createRequire(join(root, "package.json"));
/** Load real TypeScript handlers with fake Auth/DB. Never touches production data. */
export function loadRouteModule(file: string, mocks: Record<string, unknown> = {}) {
  const module = { exports: {} as Record<string, any> };
  const output = ts.transpileModule(readFileSync(join(root, file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  runInNewContext(output, { module, exports: module.exports, console, Buffer, URL, Request, Response, process, require: (name: string) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    return nativeRequire(name.startsWith("@/") ? resolve(root, name.slice(2)) : name);
  } });
  return module.exports;
}
