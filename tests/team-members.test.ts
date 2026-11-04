import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseTeamMember } from "../lib/team-member-input";
import { provisionTeamMember, TeamMemberError } from "../lib/team-member-provisioning";
import { guardApiRequest } from "../lib/api-guard";
import { MODULE_KEYS, canView, canEdit } from "../lib/permissions";
import type { AuthUser } from "../types/auth";

const valid = { name: "  Pessoa da equipe  ", email: "  PESSOA@EXAMPLE.TEST  ", password: "Senha-inicial-teste-2026", permissions: { tarefas: "edit", financeiro: "none", calendario: "view" } };
const member = parseTeamMember(valid);

test("cadastro normaliza e-mail e nome e nega permissões omitidas", () => {
  assert.equal(member.email, "pessoa@example.test"); assert.equal(member.name, "Pessoa da equipe");
  assert.equal(member.permissions.financeiro, "none"); assert.equal(member.permissions.pipeline, "none");
  assert.equal(Object.keys(member.permissions).length, MODULE_KEYS.length);
  for (const patch of [{ name: "" }, { email: "inválido" }, { password: "curta" }, { password: "a".repeat(73) }, { password: "😀".repeat(30) }, { role: "ADMIN" }, { permissions: { inexistente: "edit" } }, { permissions: { tarefas: "ADMIN" } }, { permissions: [] }, { permissions: null }]) assert.throws(() => parseTeamMember({ ...valid, ...patch }));
  for (const body of [null, [], "texto", 1]) assert.throws(() => parseTeamMember(body));
});

function fixture(options: { existingDb?: boolean; existingAuth?: boolean; authError?: string; listError?: boolean; dbError?: string; acknowledgedCommit?: boolean; recoveryError?: boolean; cleanupError?: boolean } = {}) {
  const calls = { createdIdentities: [] as any[], deletedIdentities: [] as string[], rows: [] as any[], lookups: 0 };
  let committed: any = null;
  const db = { user: {
    findFirst: async () => { calls.lookups++; return options.existingDb ? { id: "original-user" } : null; },
    findUnique: async () => { if (options.recoveryError) throw Error("connection lost"); return committed; },
    create: async (args: any) => {
      calls.rows.push(args); assert.equal(args.select.password, undefined);
      const row = { id: args.data.id, name: args.data.name, email: args.data.email, role: args.data.role, permissions: args.data.permissions };
      if (options.acknowledgedCommit) committed = row;
      if (options.dbError) throw Object.assign(Error("DB failed"), { code: options.dbError });
      committed = row; return row;
    },
  } } as unknown as PrismaClient;
  const supabase = { auth: { admin: {
    listUsers: async () => ({ data: { users: options.existingAuth ? [{ id: "original-auth", email: member.email }] : [] }, error: options.listError ? { message: "failed" } : null }),
    createUser: async (data: any) => { calls.createdIdentities.push(data); return { data: { user: options.authError ? null : { id: "new-auth-only" } }, error: options.authError ? { code: options.authError } : null }; },
    deleteUser: async (id: string) => { calls.deletedIdentities.push(id); return { error: options.cleanupError ? { message: "failed" } : null }; },
  } } } as unknown as SupabaseClient;
  return { db, supabase, calls };
}

test("cria membro com senha cifrada, permissões escolhidas e sem enviar convite", async () => {
  const { db, supabase, calls } = fixture();
  const result = await provisionTeamMember(member, db, supabase);
  assert.equal(result.role, "MEMBER"); assert.equal(Object.hasOwn(result, "password"), false);
  assert.equal(calls.createdIdentities.length, 1); assert.equal(calls.rows.length, 1);
  const identity = calls.createdIdentities[0], row = calls.rows[0].data;
  assert.equal(identity.email_confirm, true); assert.equal(identity.app_metadata.prisma_id, result.id);
  assert.equal(identity.app_metadata.role, "MEMBER"); assert.deepEqual(identity.app_metadata.permissions, member.permissions);
  assert.notEqual(row.password, valid.password); assert.equal(await bcrypt.compare(valid.password, row.password), true);
  const auth: AuthUser = { ...result, image: null, permissions: member.permissions };
  assert.equal(canEdit(auth, "tarefas"), true); assert.equal(canView(auth, "calendario"), true); assert.equal(canEdit(auth, "calendario"), false); assert.equal(canView(auth, "financeiro"), false);
  assert.deepEqual(calls.deletedIdentities, []);
});

test("não altera conta existente no aplicativo ou no Auth", async () => {
  for (const options of [{ existingDb: true }, { existingAuth: true }]) {
    const f = fixture(options);
    await assert.rejects(provisionTeamMember(member, f.db, f.supabase), (e: unknown) => e instanceof TeamMemberError && e.status === 409);
    assert.equal(f.calls.createdIdentities.length, 0); assert.equal(f.calls.rows.length, 0); assert.equal(f.calls.deletedIdentities.length, 0);
  }
});

test("falha no Auth impede criação do registro do aplicativo", async () => {
  for (const authError of ["email_exists", "user_already_exists", "weak_password", "unexpected_failure"]) {
    const f = fixture({ authError });
    await assert.rejects(provisionTeamMember(member, f.db, f.supabase), (e: unknown) => e instanceof TeamMemberError && e.status === (authError.includes("exists") ? 409 : authError === "weak_password" ? 400 : 503));
    assert.equal(f.calls.rows.length, 0); assert.equal(f.calls.deletedIdentities.length, 0);
  }
  const f = fixture({ listError: true });
  await assert.rejects(provisionTeamMember(member, f.db, f.supabase), TeamMemberError);
  assert.equal(f.calls.createdIdentities.length, 0);
});

test("se o banco falhar, remove somente a identidade nova e mantém contas antigas", async () => {
  for (const dbError of ["P2002", "connection"]) {
    const f = fixture({ dbError });
    await assert.rejects(provisionTeamMember(member, f.db, f.supabase), (e: unknown) => e instanceof TeamMemberError && e.status === (dbError === "P2002" ? 409 : 503));
    assert.deepEqual(f.calls.deletedIdentities, ["new-auth-only"]);
  }
});

test("não apaga login válido se a confirmação do banco se perder", async () => {
  const f = fixture({ dbError: "connection", acknowledgedCommit: true });
  assert.equal((await provisionTeamMember(member, f.db, f.supabase)).email, member.email);
  assert.deepEqual(f.calls.deletedIdentities, []);
  const uncertain = fixture({ dbError: "connection", recoveryError: true });
  await assert.rejects(provisionTeamMember(member, uncertain.db, uncertain.supabase), TeamMemberError);
  assert.deepEqual(uncertain.calls.deletedIdentities, []);
});

test("falha na compensação retorna erro recuperável sem anunciar sucesso", async () => {
  const f = fixture({ dbError: "connection", cleanupError: true });
  await assert.rejects(provisionTeamMember(member, f.db, f.supabase), (e: unknown) => e instanceof TeamMemberError && e.status === 503);
  assert.deepEqual(f.calls.deletedIdentities, ["new-auth-only"]);
});

test("integração com SDK do Supabase envia criação confirmada e metadados corretos", async () => {
  const calls: Array<{ url: string; body: any }> = [];
  const supabase = createClient("https://team-test.example.test", "test-only-service-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => {
    const address = String(url); const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url: address, body });
    return Response.json(init?.method === "POST" ? { id: "new-auth-only", email: member.email, aud: "authenticated", role: "authenticated", created_at: new Date().toISOString(), app_metadata: body.app_metadata, user_metadata: body.user_metadata } : { users: [], aud: "authenticated" });
  } } });
  const f = fixture(); await provisionTeamMember(member, f.db, supabase);
  const created = calls.find(call => call.body?.email);
  assert.ok(created?.url.includes("/auth/v1/admin/users")); assert.equal(created?.body.email_confirm, true);
  assert.equal(created?.body.app_metadata.role, "MEMBER"); assert.equal(created?.body.app_metadata.permissions.financeiro, "none");
});

const root = process.cwd(), nativeRequire = createRequire(join(root, "package.json"));
function loadRoute(auth: AuthUser | null, provision: (...args: any[]) => Promise<any>) {
  const module = { exports: {} as Record<string, any> };
  const source = ts.transpileModule(readFileSync(join(root, "app/api/users/route.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const mocks: Record<string, unknown> = {
    "@/lib/supabase/get-server-auth": { getServerAuth: async () => auth },
    "@/lib/prisma": { prisma: {} }, "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({}) },
    "@/lib/team-member-provisioning": { provisionTeamMember: provision, TeamMemberError },
    "@/lib/api-guard": { guardApiRequest },
  };
  runInNewContext(source, { module, exports: module.exports, console, Buffer, URL, Request, Response, process, require: (name: string) => Object.hasOwn(mocks, name) ? mocks[name] : nativeRequire(name.startsWith("@/") ? resolve(root, name.slice(2)) : name) });
  return module.exports;
}
const admin: AuthUser = { id: "admin", email: "admin@example.test", name: "Admin", role: "ADMIN", image: null, permissions: null };
const request = (body: unknown = valid, origin = "https://team.example.test") => new NextRequest("https://team.example.test/api/users", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });

test("API real só permite criação por administrador e recusa origem externa", async () => {
  let created = 0;
  const provision = async () => { created++; return { id: "new", ...member, password: undefined, role: "MEMBER" }; };
  for (const [auth, status] of [[null, 401], [{ ...admin, role: "MEMBER" }, 403]] as const) assert.equal((await loadRoute(auth, provision).POST(request())).status, status);
  assert.equal((await loadRoute(admin, provision).POST(request(valid, "https://foreign.example.test"))).status, 403);
  assert.equal((await loadRoute(admin, provision).POST(request({ ...valid, role: "ADMIN" }))).status, 400);
  assert.equal(created, 0);
  const response = await loadRoute(admin, provision).POST(request());
  assert.equal(response.status, 201); assert.equal(created, 1); assert.ok(!Object.hasOwn(await response.json(), "password"));
});

test("API devolve conflito conhecido sem expor detalhes internos", async () => {
  const conflict = await loadRoute(admin, async () => { throw new TeamMemberError("Conta existente", 409); }).POST(request());
  assert.equal(conflict.status, 409);
  const failed = await loadRoute(admin, async () => { throw Error("private-password-never-return"); }).POST(request());
  assert.equal(failed.status, 503); assert.ok(!(await failed.text()).includes("private-password"));
});
