import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { splitSql } from "./prepare-social";

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL });
const migration = "20261027120000_card_invoices_investment_links";
async function run() {
  const url = new URL(process.env.DIRECT_URL || process.env.DATABASE_URL || "https://missing.invalid");
  if (["127.0.0.1", "localhost"].includes(url.hostname)) {
    if (!/^\/finance_test_[a-z0-9_]+$/.test(url.pathname)) throw Error("Only a disposable finance_test_* local database is allowed.");
  } else {
    const expected = process.argv.find(arg => arg.startsWith("--project-ref="))?.split("=")[1];
    if (!expected || !/^[a-z0-9]{20}$/.test(expected) || new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://missing.invalid").hostname !== `${expected}.supabase.co`
      || !(url.hostname === `db.${expected}.supabase.co` || (url.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username) === `postgres.${expected}`))) throw Error("Provide --project-ref=REF matching the database and authentication project.");
  }
  const state = await prisma.$queryRaw<Array<{ present: boolean }>>`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='variable_expenses' AND column_name='cardInvoiceYear') AS present`;
  if (state[0].present) { console.log("Finance schema already installed; no changes."); return; }
  if (!process.argv.includes("--apply")) { console.log("Finance migration pending. No changes."); return; }
  const index = process.argv.indexOf("--backup-dir");
  const folder = index >= 0 ? process.argv[index + 1] : null;
  if (!folder || !path.isAbsolute(folder)) throw Error("An absolute private --backup-dir is required.");
  const workspace = path.resolve(".");
  const target = path.resolve(folder);
  if (target === workspace || target.startsWith(workspace + path.sep)) throw Error("Save financial backups outside the repository.");
  fs.mkdirSync(target, { recursive: true });
  const file = path.join(target, `finance-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const sql = fs.readFileSync(path.join("prisma", "migrations", migration, "migration.sql"), "utf8");
  const checksum = crypto.createHash("sha256").update(sql).digest("hex");
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(49218231)`;
    // Block concurrent financial writes while the recoverable copy and migration are made.
    await tx.$executeRawUnsafe('LOCK TABLE credit_cards, investments, variable_expenses, fixed_expenses, cash_entries, cash_config IN SHARE ROW EXCLUSIVE MODE');
    const backup: Record<string, unknown> = { at: new Date().toISOString(), migration, checksum };
    for (const table of ["credit_cards", "investments", "variable_expenses", "fixed_expenses", "cash_entries", "cash_config"]) backup[table] = await tx.$queryRawUnsafe(`SELECT * FROM "${table}"`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    for (const statement of splitSql(sql)) await tx.$executeRawUnsafe(statement);
    const rows = await tx.$queryRaw<Array<{ present: boolean }>>`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`;
    if (rows[0].present) await tx.$executeRaw`INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count) VALUES (${crypto.randomUUID()}, ${checksum}, NOW(), ${migration}, 1)`;
  }, { timeout: 120000, maxWait: 20000 });
  console.log("Finance migration applied. Private backup saved:", file);
}
run().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
