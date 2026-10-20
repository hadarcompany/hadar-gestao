import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextRequest } from "next/server";
import type { AuthUser } from "../types/auth";
import { canAccessApi, hasGlobalTaskAccess, validMutationOrigin } from "../lib/api-policy";
import { guardApiRequest } from "../lib/api-guard";
import { createLoginLimiter, parseLogin } from "../lib/login-security";
import { CLIENT_FIELDS, TASK_FIELDS, pickWritableFields } from "../lib/security-input";
import { publicOrigin } from "../lib/public-url";

const root = process.cwd();
const nativeRequire = createRequire(join(root, "package.json"));
const admin: AuthUser = { id: "admin", email: "admin@example.test", name: "Admin", role: "ADMIN", image: null, permissions: null };
const member: AuthUser = { ...admin, id: "member", role: "MEMBER", permissions: { tarefas: "view", clientes: "view" } };
const personal: AuthUser = { ...member, permissions: { "meu-trabalho": "edit" } };

/** Execute real handlers with fake Auth/DB; no test touches production data. */
function loadModule(file: string, mocks: Record<string, unknown> = {}) {
  const module = { exports: {} as Record<string, any> };
  const source = readFileSync(join(root, file), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  runInNewContext(output, { module, exports: module.exports, console, Buffer, URL, Request, Response, process, require: (name: string) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    return nativeRequire(name.startsWith("@/") ? resolve(root, name.slice(2)) : name);
  } });
  return module.exports;
}

const request = (path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) => new NextRequest(`https://gestao.example.test${path}`, { method, headers: { ...headers, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
const context = (id = "task-1") => ({ params: Promise.resolve({ id }) });
const authMock = (user: AuthUser | null) => ({ getServerAuth: async () => user });

test("visualização não permite edição/exclusão; desconhecidos e Acessos negados mesmo para admin", () => {
  for (const path of ["/api/tasks", "/api/tasks/[id]", "/api/clients/[id]"]) {
    assert.equal(canAccessApi(member, path, "GET"), true);
    for (const method of ["POST", "PATCH", "DELETE"]) assert.equal(canAccessApi(member, path, method), false);
  }
  assert.equal(canAccessApi(admin, "/api/accesses", "GET"), false);
  assert.equal(canAccessApi(admin, "/api/future-module", "POST"), false);
  assert.equal(canAccessApi({ ...member, permissions: null }, "/api/tasks", "GET"), false);
  assert.equal(hasGlobalTaskAccess(personal), false);
});

test("origem externa não pode modificar dados, inclusive com sessão", () => {
  assert.equal(validMutationOrigin(request("/api/tasks", "POST", {}, { origin: "https://attacker.test" })), false);
  assert.equal(validMutationOrigin(request("/api/tasks", "POST", {}, { origin: "https://gestao.example.test" })), true);
  assert.equal(validMutationOrigin(request("/api/tasks", "POST", {}, { "sec-fetch-site": "cross-site" })), false);
});

test("VPS aceita a origem pública configurada e rejeita origem forjada por headers do proxy", () => {
  const external = "https://insider.example.test";
  const proxied = (origin: string) => new Request("https://localhost:3000/api/auth/login", { method: "POST", headers: { origin, "x-forwarded-host": "attacker.test" } });
  assert.equal(validMutationOrigin(proxied(external), external), true);
  assert.equal(validMutationOrigin(proxied("https://attacker.test"), external), false);
  assert.equal(validMutationOrigin(proxied("https://localhost:3000"), external), false);
  assert.equal(validMutationOrigin(proxied(external), "invalid URL"), false);
  assert.equal(publicOrigin(proxied(external).url, external), external);
  assert.equal(publicOrigin("https://gestao.example.test/api/tasks", ""), "https://gestao.example.test");
  assert.throws(() => publicOrigin(proxied(external).url, "https://user:password@example.test"));
});

test("API real de tarefa bloqueia membro sem edição antes de consultar ou gravar dados", async () => {
  const route = loadModule("app/api/tasks/[id]/route.ts", { "@/lib/supabase/get-server-auth": authMock(member), "@/lib/prisma": { prisma: {} } });
  assert.equal((await route.PATCH(request("/api/tasks/task-1", "PATCH", { title: "Não permitido" }), context())).status, 403);
  assert.equal((await route.DELETE(request("/api/tasks/task-1", "DELETE"), context())).status, 403);
});

test("Meu Trabalho consulta propriedade no banco e rejeita tarefa de outra pessoa", async () => {
  const database = { task: { findFirst: async (args: any) => { assert.equal(args.where.OR[1].assignees.some.userId, personal.id); return null; } } };
  const denied = await guardApiRequest(personal, request("/api/tasks/other"), "/api/tasks/[id]", "other", database as any);
  assert.equal(denied?.status, 404);
});

test("listagem real de Meu Trabalho impõe escopo próprio mesmo alterando o filtro", async () => {
  let checked = false;
  const route = loadModule("app/api/tasks/route.ts", {
    "@/lib/supabase/get-server-auth": authMock(personal),
    "@/lib/prisma": { prisma: { task: { findMany: async (args: any) => { checked = true; assert.equal(args.where.OR[0].createdById, personal.id); assert.equal(args.where.OR[1].assignees.some.userId, personal.id); return []; } } } },
    "@/lib/media": { withMedia: async (value: unknown) => value },
  });
  assert.equal((await route.GET(request("/api/tasks?assigneeId=other"))).status, 200);
  assert.equal(checked, true);
});

test("campos internos e relações Prisma não podem ser injetados em edições", () => {
  for (const key of ["createdById", "createdAt", "updatedAt", "completedAt", "assignees", "updates", "createdBy"]) assert.throws(() => pickWritableFields({ [key]: "other" }, TASK_FIELDS));
  for (const key of ["accesses", "tasks", "services", "asaasCustomerId", "id"]) assert.throws(() => pickWritableFields({ [key]: { create: {} } }, CLIENT_FIELDS));
  assert.deepEqual(pickWritableFields({ title: "Tarefa", clientId: "client-1" }, TASK_FIELDS), { title: "Tarefa", clientId: "client-1" });
});

test("API real de cliente não busca nem devolve credenciais de plataformas", async () => {
  const route = loadModule("app/api/clients/[id]/route.ts", {
    "@/lib/supabase/get-server-auth": authMock(member),
    "@/lib/prisma": { prisma: { client: { findUnique: async (args: any) => { assert.equal(args.include.accesses, undefined); return { id: "client-1", name: "Cliente", services: [] }; } } } },
    "@/lib/media": { withMedia: async (value: unknown) => value },
  });
  const response = await route.GET(request("/api/clients/client-1"), context("client-1"));
  const data = await response.json();
  assert.equal(response.status, 200); assert.equal(data.accesses, undefined);
});

test("Acessos não executa operações e responde 410", async () => {
  for (const file of ["app/api/accesses/route.ts", "app/api/accesses/[id]/route.ts"]) {
    const route = loadModule(file);
    for (const handler of Object.values(route)) assert.equal((await (handler as () => any)()).status, 410);
  }
});

test("login recusado pelo Auth não consulta hash legado nem redefine senha", async () => {
  const route = loadModule("app/api/auth/login/route.ts", {
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({ auth: { signInWithPassword: async () => ({ error: { message: "Invalid credentials" }, data: {} }) } }) },
    "@/lib/prisma": { prisma: {} },
    "@/lib/login-security": { parseLogin, allowLoginAttempt: () => true },
  });
  assert.equal((await route.POST(request("/api/auth/login", "POST", { email: "member@example.test", password: "old-password" }))).status, 401);
});

test("cargo e permissões vêm do banco e não dos metadados antigos", async () => {
  const make = (dbUser: unknown) => loadModule("lib/supabase/get-server-auth.ts", {
    "./server": { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { email: "member@example.test", app_metadata: { role: "ADMIN", permissions: { financeiro: "edit" } } } }, error: null }) } }) },
    "@/lib/prisma": { prisma: { user: { findFirst: async () => dbUser } } },
  });
  assert.equal(await make(null).getServerAuth(), null);
  const auth = await make({ ...member, permissions: null }).getServerAuth();
  assert.equal(auth.role, "MEMBER"); assert.equal(auth.permissions, null);
});

test("login normaliza e-mail e limita tentativas e memória", () => {
  assert.deepEqual(parseLogin({ email: " MEMBER@example.test ", password: "secret" }), { email: "member@example.test", password: "secret" });
  assert.equal(parseLogin({ email: {}, password: [] }), null);
  const limiter = createLoginLimiter(2, 1000, 1);
  assert.equal(limiter("member", 0), true); assert.equal(limiter("member", 1), true); assert.equal(limiter("member", 2), false);
  assert.equal(limiter("different", 2), false); assert.equal(limiter("member", 1001), true);
});

test("todos os handlers autenticados aplicam a autorização dentro da API", () => {
  const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
  for (const file of walk(join(root, "app/api")).filter(file => file.endsWith("route.ts"))) {
    const source = readFileSync(file, "utf8");
    if (!source.includes("getServerAuth()")) continue;
    const handlers = source.split(/(?=export async function (?:GET|POST|PATCH|PUT|DELETE)\()/).filter(block => block.startsWith("export async function"));
    for (const block of handlers) if (block.includes("getServerAuth()")) assert.ok(block.includes("guardApiRequest(auth,") || block.includes("requireAssistantIntegrationAdmin(await getServerAuth())"), file);
  }
});
