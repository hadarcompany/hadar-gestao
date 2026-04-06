import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
const users = [
  {
    name: "Felipe",
    email: "felipe@agenciahadar.com.br",
    password: "Lipinho2017_",
    role: Role.ADMIN,
  },
  {
    name: "Alexandre",
    email: "alexandre@agenciahadar.com.br",
    password: "ALEhadar2024",
    role: Role.MEMBER,
  },
  {
    name: "Luiz",
    email: "luiz@agenciahadar.com.br",
    password: "agCHADAR2024",
    role: Role.MEMBER,
  },
];

const createdUsers: any = {};

for (const user of users) {
  const hashedPassword = await bcrypt.hash(user.password, 10);

  const created = await prisma.user.upsert({
    where: { email: user.email },
    update: {},
    create: {
      name: user.name,
      email: user.email,
      password: hashedPassword,
      role: user.role,
    },
  });

  createdUsers[user.name.toLowerCase()] = created;
}

const felipe = createdUsers["felipe"];
const alexandre = createdUsers["alexandre"];
const luiz = createdUsers["luiz"];

  // Clients
  const clientAlpha = await prisma.client.create({
    data: {
      name: "Restaurante Sabor & Arte",
      email: "contato@saborarte.com",
      status: "ACTIVE",
      driveLink: "https://drive.google.com/example-sabor",
      contractStartDate: new Date("2024-01-15"),
      renewalDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 dias
      briefing: "Restaurante italiano premium. Foco em delivery e experiência no salão. Público 25-45 anos, classe A/B.",
    },
  });

  const clientBeta = await prisma.client.create({
    data: {
      name: "Studio Fitness Pro",
      email: "adm@fitnesspro.com",
      status: "ACTIVE",
      contractStartDate: new Date("2024-02-01"),
      renewalDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      briefing: "Academia boutique. Foco em treinos personalizados. Instagram como principal canal.",
    },
  });

  const clientGamma = await prisma.client.create({
    data: {
      name: "Tech Solutions LTDA",
      email: "mkt@techsolutions.com",
      status: "ACTIVE",
      contractStartDate: new Date("2024-03-01"),
      renewalDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
  });

  const clientProspect = await prisma.client.create({
    data: {
      name: "Nova Marca Co.",
      email: "contato@novamarca.com",
      status: "PROSPECT",
    },
  });

  // Tasks with checklists
  const now = new Date();
  const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const inTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  await prisma.task.create({
    data: {
      title: "Calendário Editorial - Sabor & Arte - Abril",
      type: "calendario_editorial",
      status: "IN_PROGRESS",
      priority: "HIGH",
      startDate: now,
      dueDate: inOneWeek,
      estimatedTime: 6,
      clientId: clientAlpha.id,
      createdById: felipe.id,
      checklist: [
        { id: "ce-1", text: "Análise de métricas do mês anterior", checked: true },
        { id: "ce-2", text: "Estudo de tendências do mês", checked: true },
        { id: "ce-3", text: "Criar planejamento.docx", checked: false },
        { id: "ce-4", text: "Enviar para aprovação do cliente", checked: false },
        { id: "ce-5", text: "Cliente aprovou", checked: false },
        { id: "ce-6", text: "Criar roteiros", checked: false },
        { id: "ce-7", text: "Agendar captação", checked: false },
      ],
      extraFields: { qtd_reels: "4", qtd_carrosseis: "2", qtd_posts_avulsos: "3", qtd_criativos_trafego: "2" },
      tags: ["planejamento", "mensal"],
      assignees: { create: [{ userId: luiz.id }, { userId: felipe.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: "Captação - Studio Fitness Pro",
      type: "captacao",
      status: "PENDING",
      priority: "HIGH",
      dueDate: inTwoWeeks,
      estimatedTime: 4,
      clientId: clientBeta.id,
      createdById: alexandre.id,
      checklist: [
        { id: "cap-1", text: "Carregar equipamentos", checked: false },
        { id: "cap-2", text: "Check: Câmera", checked: false },
        { id: "cap-3", text: "Check: Lente", checked: false },
        { id: "cap-4", text: "Check: Microfone", checked: false },
        { id: "cap-5", text: "Check: Tripé", checked: false },
        { id: "cap-6", text: "Check: Teleprompter", checked: false },
        { id: "cap-7", text: "Check: Cartão SD", checked: false },
        { id: "cap-8", text: "Check: Baterias", checked: false },
        { id: "cap-9", text: "Check: Luz", checked: false },
        { id: "cap-10", text: "Revisar roteiros do planejamento", checked: false },
        { id: "cap-11", text: "Captação concluída", checked: false },
        { id: "cap-12", text: "Subir arquivos no Drive", checked: false },
        { id: "cap-13", text: "Organizar em pastas", checked: false },
        { id: "cap-14", text: "Criar tarefas individuais com datas", checked: false },
      ],
      tags: ["captação", "vídeo"],
      assignees: { create: [{ userId: alexandre.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: "Reels #1 - Receita do Chef",
      type: "reels",
      status: "IN_REVIEW",
      priority: "MEDIUM",
      dueDate: yesterday,
      estimatedTime: 2,
      clientId: clientAlpha.id,
      createdById: luiz.id,
      checklist: [
        { id: "r1-1", text: "Edição", checked: true },
        { id: "r1-2", text: "Subir no Drive", checked: true },
        { id: "r1-3", text: "Fazer capa", checked: true },
        { id: "r1-4", text: "Aprovação", checked: false },
        { id: "r1-5", text: "Programação", checked: false },
      ],
      assignees: { create: [{ userId: luiz.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: "Relatório Mensal - Março",
      type: "relatorio_mensal",
      status: "COMPLETED",
      priority: "MEDIUM",
      dueDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      estimatedTime: 3,
      actualTime: 2.5,
      clientId: clientBeta.id,
      createdById: felipe.id,
      checklist: [
        { id: "rm-1", text: "Coletar métricas redes sociais", checked: true },
        { id: "rm-2", text: "Coletar métricas tráfego pago", checked: true },
        { id: "rm-3", text: "Analisar resultados", checked: true },
        { id: "rm-4", text: "Montar relatório", checked: true },
        { id: "rm-5", text: "Enviar ao cliente", checked: true },
      ],
      assignees: { create: [{ userId: felipe.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: "Criativo de Tráfego - Promoção Verão",
      type: "criativo_trafego",
      status: "PENDING",
      priority: "URGENT",
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      estimatedTime: 1.5,
      clientId: clientAlpha.id,
      createdById: felipe.id,
      checklist: [
        { id: "ct-1", text: "Briefing do que precisa", checked: true },
        { id: "ct-2", text: "Criação", checked: false },
        { id: "ct-3", text: "Aprovação", checked: false },
        { id: "ct-4", text: "Subir no Gerenciador de Anúncios", checked: false },
      ],
      tags: ["tráfego", "promoção"],
      assignees: { create: [{ userId: luiz.id }, { userId: alexandre.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: "Onboarding - Nova Marca Co.",
      type: "onboarding",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: inOneWeek,
      estimatedTime: 8,
      clientId: clientProspect.id,
      createdById: felipe.id,
      checklist: [
        { id: "on-1", text: "Coletar dados para contrato", checked: true },
        { id: "on-2", text: "Elaboração de contrato", checked: true },
        { id: "on-3", text: "Envio para assinatura", checked: true },
        { id: "on-4", text: "Contrato assinado", checked: false },
        { id: "on-5", text: "Cadastro do cliente no sistema", checked: false },
        { id: "on-6", text: "Cadastro no ASAAS", checked: false },
        { id: "on-7", text: "Criar grupo WhatsApp", checked: false },
        { id: "on-8", text: "Enviar e coletar Briefing", checked: false },
        { id: "on-9", text: "Iniciar Planejamento Mensal", checked: false },
      ],
      assignees: { create: [{ userId: felipe.id }, { userId: alexandre.id }] },
    },
  });

  // Interactions
  await prisma.interaction.createMany({
    data: [
      { type: "PRAISE", content: "Cliente adorou o último reels do chef. Pediu mais conteúdos assim!", clientId: clientAlpha.id, authorId: felipe.id },
      { type: "REQUEST", content: "Pediu para incluir mais fotos de pratos no feed.", clientId: clientAlpha.id, authorId: luiz.id },
      { type: "NOTE", content: "Reunião realizada. Alinhamos expectativas para o próximo trimestre.", clientId: clientBeta.id, authorId: alexandre.id },
      { type: "COMPLAINT", content: "Reclamou de atraso na entrega do relatório de março.", clientId: clientBeta.id, authorId: felipe.id },
    ],
  });

  // Accesses
  await prisma.access.createMany({
    data: [
      { platform: "Instagram", url: "https://instagram.com", email: "saborarte@gmail.com", password: "Sabor@2024!", clientId: clientAlpha.id },
      { platform: "Meta Business", url: "https://business.facebook.com", email: "saborarte@gmail.com", password: "Meta#Sabor24", clientId: clientAlpha.id },
      { platform: "Instagram", url: "https://instagram.com", email: "fitnesspro@gmail.com", password: "Fitness@Pro2024", clientId: clientBeta.id },
      { platform: "Google Meu Negócio", url: "https://business.google.com", email: "adm@fitnesspro.com", password: "GoogleFit24!", clientId: clientBeta.id },
    ],
  });

  console.log("✅ Seed completed successfully!");
  console.log(`   Users: Felipe (admin), Alexandre (admin), Luiz (membro)`);
  console.log(`   Clients: ${clientAlpha.name}, ${clientBeta.name}, ${clientGamma.name}, ${clientProspect.name}`);
  console.log(`   Tasks: 6 tarefas com checklists`);
  console.log(`   Interactions: 4 registros`);
  console.log(`   Accesses: 4 credenciais`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
