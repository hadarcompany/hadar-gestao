import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeWhatsAppPhone, whatsappPhonesMatch } from "@/lib/whatsapp/phones";

interface StoreMessageInput {
  chatId: string;
  phone: string;
  name?: string | null;
  body: string;
  sentAt: Date;
  externalId?: string | null;
  fromMe: boolean;
}

async function resolveContact(phone: string, name: string | null, createLead: boolean) {
  const [clients, leads] = await Promise.all([
    prisma.client.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } }),
    prisma.lead.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } }),
  ]);
  const client = clients.find((item) => whatsappPhonesMatch(item.phone, phone));
  if (client) return { clientId: client.id, leadId: null, contactKind: "CLIENT" as const };
  const lead = leads.find((item) => whatsappPhonesMatch(item.phone, phone));
  if (lead) return { clientId: null, leadId: lead.id, contactKind: "EXISTING_LEAD" as const };
  if (!createLead) return { clientId: null, leadId: null, contactKind: "UNKNOWN" as const };
  const created = await prisma.lead.create({
    data: { name: name || `WhatsApp ${phone.slice(-4)}`, phone: `+${phone}`, origin: "WhatsApp", stage: "NOVO" },
    select: { id: true },
  });
  return { clientId: null, leadId: created.id, contactKind: "NEW_LEAD" as const };
}

export async function storeWhatsAppMessage(input: StoreMessageInput) {
  const phone = normalizeWhatsAppPhone(input.phone || input.chatId);
  if (!phone) return null;
  const existing = await prisma.whatsAppConversation.findUnique({ where: { chatId: input.chatId } });
  const resolved = await resolveContact(phone, input.name?.trim() || null, !input.fromMe);
  const contact = resolved.contactKind === "UNKNOWN" && existing
    ? { clientId: existing.clientId, leadId: existing.leadId, contactKind: existing.contactKind }
    : resolved;
  const conversation = await prisma.whatsAppConversation.upsert({
    where: { chatId: input.chatId },
    create: {
      chatId: input.chatId,
      phone: `+${phone}`,
      name: input.name?.trim() || null,
      clientId: contact.clientId,
      leadId: contact.leadId,
      contactKind: contact.contactKind,
      lastMessage: input.body,
      lastMessageAt: input.sentAt,
      unreadCount: input.fromMe ? 0 : 1,
    },
    update: {
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      ...(contact.clientId ? { clientId: contact.clientId, leadId: null } : {}),
      ...(contact.leadId ? { leadId: contact.leadId, clientId: null } : {}),
      contactKind: contact.contactKind,
      phone: `+${phone}`,
      lastMessage: input.body,
      lastMessageAt: input.sentAt,
      ...(input.fromMe ? {} : { unreadCount: { increment: 1 } }),
    },
  });
  try {
    await prisma.whatsAppMessage.create({
      data: {
        externalId: input.externalId || null,
        conversationId: conversation.id,
        direction: input.fromMe ? "OUTBOUND" : "INBOUND",
        body: input.body,
        status: input.fromMe ? "SENT" : "RECEIVED",
        sentAt: input.sentAt,
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
  }
  return conversation;
}

export async function updateWhatsAppMessageStatus(externalId: string, status: string) {
  await prisma.whatsAppMessage.updateMany({ where: { externalId }, data: { status: status.toUpperCase() } });
}
