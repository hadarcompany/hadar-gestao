import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();
async function main() {
  const apply = process.argv.includes("--apply");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const existing = new Set<string>();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("Não foi possível conferir as contas no Supabase Auth.");
    data.users.forEach(user => { if (user.email) existing.add(user.email.toLowerCase()); });
    if (data.users.length < 1000) break;
  }
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, permissions: true, password: true } });
  const missing = users.filter(user => !existing.has(user.email.toLowerCase()));
  console.log(JSON.stringify({ apply, accounts: users.length, missingAuthAccounts: missing.length }));
  if (!apply) return;
  // Only import absent accounts. An existing Auth password is never overwritten.
  for (const user of missing) {
    if (!/^\$2[aby]\$/.test(user.password)) throw new Error("Conta legada sem hash bcrypt válido. Faça a recuperação por um administrador.");
    const { error } = await supabase.auth.admin.createUser({ email: user.email.trim().toLowerCase(), password_hash: user.password, email_confirm: true, user_metadata: { name: user.name }, app_metadata: { prisma_id: user.id, role: user.role, permissions: user.permissions } });
    if (error) throw new Error("Falha ao importar conta legada; nenhuma senha existente foi redefinida.");
  }
  const sql = await readFile("prisma/sql/enable-rls.sql", "utf8");
  // Execute only the fixed DO block. No client input, records deleted or schema changes.
  const block = sql.match(/DO \$\$[\s\S]*?END \$\$;/)?.[0];
  if (!block) throw new Error("Script RLS inválido.");
  await prisma.$executeRawUnsafe(block);
  const unprotected = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity`;
  if (unprotected.length) throw new Error("Ainda há tabelas sem RLS.");
  console.log(JSON.stringify({ importedAuthAccounts: missing.length, allPublicTablesProtected: true }));
}
main().catch(() => { console.error("Falha na manutenção. Confira as credenciais e a configuração no servidor; segredos não foram exibidos."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
