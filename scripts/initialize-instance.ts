import "dotenv/config";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

// Fresh installs only. Never use this for updates or for the Hadar database.
const prisma = new PrismaClient();
async function main() {
  const expected = process.argv[2];
  if (!expected || !/^[a-z0-9]{20}$/.test(expected)) throw new Error("Informe explicitamente o project ref do NOVO Supabase.");
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  if (url.protocol !== "https:" || url.hostname !== `${expected}.supabase.co`) throw new Error("O projeto de autenticação não corresponde ao projeto informado.");
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const connection = new URL(process.env[key] || "");
    if (!["postgres:", "postgresql:"].includes(connection.protocol) || !(connection.hostname === `db.${expected}.supabase.co` || (connection.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(connection.username) === `postgres.${expected}`))) throw new Error("A conexão do banco não corresponde ao projeto informado.");
  }
  if (!process.env.INTEGRATIONS_ENCRYPTION_KEY || process.env.INTEGRATIONS_ENCRYPTION_KEY.length < 32) throw new Error("Defina uma chave de criptografia exclusiva, com pelo menos 32 caracteres.");
  if (!process.env.BOOTSTRAP_ADMIN_NAME?.trim() || !process.env.BOOTSTRAP_ADMIN_EMAIL?.trim() || (process.env.BOOTSTRAP_ADMIN_PASSWORD?.length || 0) < 12) throw new Error("Configure o administrador inicial e uma senha de pelo menos 12 caracteres.");
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  if (tables.length) throw new Error("Operação recusada: o banco já contém tabelas. Não foi alterado.");
  const auth = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await auth.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error || data.users.length) throw new Error("Operação recusada: não foi possível confirmar que o Supabase Auth está vazio.");
  await prisma.$disconnect();
  const steps = [
    ["Estrutura do banco", ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"]],
    ["Proteção RLS", ["node_modules/tsx/dist/cli.mjs", "scripts/security-maintenance.ts", "--apply"]],
    ["Administrador inicial", ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"]],
  ] as const;
  for (const [label, args] of steps) {
    const result = spawnSync(process.execPath, [...args], { env: process.env, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`Falha em: ${label}. Pare e confira a etapa no servidor; nenhuma limpeza automática foi executada.`);
    console.log(`${label}: concluído.`);
  }
  console.log("Instalação inicial pronta, sem dados ou integrações da Hadar.");
}
main().catch(error => { console.error(error instanceof Error && !error.name.startsWith("Prisma") && error.name !== "TypeError" ? error.message : "Falha na inicialização; confira a configuração no servidor."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
