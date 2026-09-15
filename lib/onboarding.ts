import { prisma } from "@/lib/prisma";
import { addDaysToKey, dateKeyToUTCDate, getTodayKey } from "@/lib/dates";

/** Passos do onboarding de cliente novo. `days` = prazo em dias úteis a partir do cadastro. */
export const ONBOARDING_STEPS: { title: string; days: number }[] = [
  { title: "Conferir se a cobrança do serviço foi paga", days: 1 },
  { title: "Criar grupo do WhatsApp", days: 1 },
  { title: "Criar pasta no Drive para o cliente", days: 1 },
  { title: "Cadastrar cliente no Asaas, Conta Simples e demais plataformas", days: 2 },
  { title: "Adicionar informações do cliente no quadro de controle", days: 2 },
  { title: "Subir contrato no Drive", days: 2 },
  { title: "Marcar e fazer reunião de kick-off", days: 3 },
  { title: "Solicitar fotos, vídeos, identidade visual, logo etc.", days: 3 },
  { title: "Criar projeto de inicialização do cliente", days: 5 },
];

function addBusinessDays(startKey: string, days: number): string {
  let key = startKey;
  let added = 0;
  while (added < days) {
    key = addDaysToKey(key, 1);
    const dow = dateKeyToUTCDate(key).getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return key;
}

/**
 * Cria o projeto de onboarding do cliente com as tarefas padrão, sem responsável.
 * Idempotente: se o cliente já tem um onboarding, não cria outro.
 */
export async function createClientOnboarding(client: { id: string; name: string }, createdById: string) {
  const existing = await prisma.project.findFirst({
    where: { clientId: client.id, kind: "ONBOARDING" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const today = getTodayKey();
  const lastStep = Math.max(...ONBOARDING_STEPS.map((s) => s.days));

  const project = await prisma.project.create({
    data: {
      name: `Onboarding — ${client.name}`,
      kind: "ONBOARDING",
      status: "EM_ANDAMENTO",
      color: "#8b5cf6",
      clientId: client.id,
      createdById,
      dueDate: dateKeyToUTCDate(addBusinessDays(today, lastStep)),
    },
  });

  await prisma.task.createMany({
    data: ONBOARDING_STEPS.map((step) => ({
      title: step.title,
      type: "onboarding",
      area: "OPERACAO",
      status: "PENDING" as const,
      priority: "MEDIUM" as const,
      dueDate: dateKeyToUTCDate(addBusinessDays(today, step.days)),
      clientId: client.id,
      projectId: project.id,
      createdById,
      tags: ["onboarding"],
    })),
  });

  return project.id;
}
