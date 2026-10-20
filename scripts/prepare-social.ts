import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { createSupabaseAdminClient } from "../lib/supabase/admin";

// Fixed, additive migration for existing installations. Never run db push/seed.
export function splitSql(source: string) {
  const statements: string[] = [];
  let current = "",
    quote = false,
    dollar = false,
    comment = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i],
      next = source[i + 1];
    if (comment) {
      if (c === "\n") {
        comment = false;
        current += "\n";
      }
      continue;
    }
    if (!quote && !dollar && c === "-" && next === "-") {
      comment = true;
      i++;
      continue;
    }
    if (!quote && c === "$" && next === "$") {
      dollar = !dollar;
      current += "$$";
      i++;
      continue;
    }
    if (!dollar && c === "'") {
      if (quote && next === "'") {
        current += "''";
        i++;
        continue;
      }
      quote = !quote;
    }
    if (c === ";" && !quote && !dollar) {
      if (current.trim()) statements.push(current.trim());
      current = "";
    } else current += c;
  }
  if (quote || dollar) throw Error("Migração inválida.");
  if (current.trim()) statements.push(current.trim());
  return statements;
}
async function main() {
  const expected = process.argv
    .find((arg) => arg.startsWith("--project-ref="))
    ?.split("=")[1];
  if (!expected || !/^[a-z0-9]{20}$/.test(expected))
    throw Error("Informe --project-ref=REF do Supabase esperado.");
  if (
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").hostname !==
    `${expected}.supabase.co`
  )
    throw Error("Projeto de autenticação incorreto.");
  const url = new URL(process.env.DIRECT_URL || "");
  if (
    !(
      url.hostname === `db.${expected}.supabase.co` ||
      (url.hostname.endsWith(".pooler.supabase.com") &&
        decodeURIComponent(url.username) === `postgres.${expected}`)
    )
  )
    throw Error(
      "A conexão administrativa não corresponde ao projeto esperado.",
    );
  const database = new PrismaClient({ datasources: { db: { url: url.href } } });
  try {
    const targets = [
      "social_accounts",
      "social_assets",
      "social_posts",
      "social_oauth_sessions",
      "social_worker_state",
    ];
    const existing = await database.$queryRaw<
      { tablename: string }[]
    >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY(${targets}::text[])`;
    console.log(
      JSON.stringify({
        project: expected,
        apply: process.argv.includes("--apply"),
        existingTables: existing.length,
        newTables: 5,
      }),
    );
    if (!process.argv.includes("--apply")) return;
    if (existing.length !== 0 && existing.length !== 5)
      throw Error("Instalação parcial: conferir antes de continuar.");
    if (!existing.length) {
      const sql = await readFile(
        "prisma/migrations/20261020230000_social_publishing/migration.sql",
        "utf8",
      );
      await database.$transaction(
        async (tx) => {
          for (const statement of splitSql(sql))
            await tx.$executeRawUnsafe(statement);
        },
        { timeout: 60000 },
      );
    }
    const unprotected = await database.$queryRaw<
      { tablename: string }[]
    >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY(${targets}::text[]) AND NOT rowsecurity`;
    if (unprotected.length) throw Error("As tabelas precisam de RLS.");
    // Confirm the current schema, rather than treating any five tables as ready.
    await database.socialAsset.findFirst({
      select: { reservedBytes: true, verifiedAt: true },
    });
    const storage = createSupabaseAdminClient().storage;
    const { data: bucket, error } = await storage.getBucket("social-media");
    if (error && error.message !== "Bucket not found")
      throw Error("Não foi possível conferir o bucket privado.");
    if (!bucket) {
      const created = await storage.createBucket("social-media", {
        public: false,
        fileSizeLimit: 200 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "video/mp4"],
      });
      if (created.error)
        throw Error("Não foi possível criar o bucket privado.");
    } else if (bucket.public)
      throw Error(
        "O bucket social-media está público. Corrigir antes de ativar o módulo.",
      );
    else {
      const configured = await storage.updateBucket("social-media", {
        public: false,
        fileSizeLimit: 200 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "video/mp4"],
      });
      if (configured.error)
        throw Error("Não foi possível conferir os limites do bucket privado.");
    }
    console.log(
      JSON.stringify({
        schemaReady: true,
        allNewTablesProtected: true,
        privateMediaBucket: true,
      }),
    );
  } finally {
    await database.$disconnect();
  }
}
// Exporting the parser is useful for tests; importing this module must not migrate.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/prepare-social.ts"))
  main().catch(() => {
    console.error(
      "Preparação interrompida. Confira o projeto, o backup e as credenciais administrativas; nenhum segredo foi exibido.",
    );
    process.exitCode = 1;
  });
