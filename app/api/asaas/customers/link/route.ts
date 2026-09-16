import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { AsaasApiError, getAsaasCustomer } from "@/lib/asaas";
import { canEdit } from "@/lib/permissions";

type Mapping = { asaasCustomerId: string; clientId: string };

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para vincular clientes." }, { status: 403 });

  try {
    const body = await req.json();
    const rawMappings: unknown[] = Array.isArray(body.mappings) ? body.mappings : [];
    const mappings = rawMappings.filter((item): item is Mapping => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<Mapping>;
      return Boolean(candidate.asaasCustomerId && candidate.clientId);
    });
    if (mappings.length === 0) return NextResponse.json({ error: "Selecione ao menos um vínculo." }, { status: 400 });
    if (new Set(mappings.map((item) => item.clientId)).size !== mappings.length) {
      return NextResponse.json({ error: "Um cliente do sistema não pode ser associado a dois clientes diferentes do Asaas." }, { status: 400 });
    }

    const localClients = await prisma.client.findMany({
      where: { id: { in: mappings.map((item) => item.clientId) } },
      select: { id: true, asaasCustomerId: true, cpfCnpj: true, email: true },
    });
    if (localClients.length !== mappings.length) return NextResponse.json({ error: "Um dos clientes selecionados não foi encontrado." }, { status: 404 });

    const remoteCustomers = await Promise.all(mappings.map((item) => getAsaasCustomer(item.asaasCustomerId)));
    for (let index = 0; index < mappings.length; index++) {
      const mapping = mappings[index];
      const local = localClients.find((client) => client.id === mapping.clientId)!;
      if (local.asaasCustomerId && local.asaasCustomerId !== mapping.asaasCustomerId) {
        return NextResponse.json({ error: "Um dos clientes selecionados já está vinculado a outro cadastro do Asaas." }, { status: 409 });
      }
      const alreadyLinked = await prisma.client.findUnique({ where: { asaasCustomerId: mapping.asaasCustomerId }, select: { id: true } });
      if (alreadyLinked && alreadyLinked.id !== mapping.clientId) {
        return NextResponse.json({ error: "Um cadastro do Asaas já está vinculado a outro cliente do sistema." }, { status: 409 });
      }
      const remote = remoteCustomers[index];
      await prisma.client.update({
        where: { id: mapping.clientId },
        data: {
          asaasCustomerId: mapping.asaasCustomerId,
          cpfCnpj: local.cpfCnpj || remote.cpfCnpj?.replace(/\D/g, "") || null,
          email: local.email || remote.email || null,
        },
      });
    }

    return NextResponse.json({ linked: mappings.length });
  } catch (error) {
    if (error instanceof AsaasApiError) return NextResponse.json({ error: error.message }, { status: error.status >= 500 ? 502 : error.status });
    console.error("Erro ao vincular clientes do Asaas:", error);
    return NextResponse.json({ error: "Não foi possível vincular os clientes." }, { status: 500 });
  }
}
