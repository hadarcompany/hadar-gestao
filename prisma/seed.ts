import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
async function main() {
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!name || !email || !password || password.length < 12) throw new Error("Configure BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL e uma senha de pelo menos 12 caracteres.");
  if (await prisma.user.count()) throw new Error("Inicialização permitida somente em uma instalação sem usuários.");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const user = await prisma.user.create({ data: { name, email, password: await bcrypt.hash(password, 12), role: "ADMIN" } });
  const { error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name }, app_metadata: { prisma_id: user.id, role: user.role } });
  if (error) { await prisma.user.delete({ where: { id: user.id } }); throw new Error("Não foi possível preparar a autenticação da conta inicial."); }
  console.log("Administrador inicial criado, sem dados ou senhas de demonstração.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
