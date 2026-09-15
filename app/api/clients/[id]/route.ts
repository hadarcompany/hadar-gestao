import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";

export async function GET(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    omit: { logoUrl: true },
    include: {
      _count: { select: { tasks: true } },
      tasks: {
        include: { assignees: { include: { user: { select: { id: true, name: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      interactions: {
        orderBy: { date: "desc" },
        include: { author: { select: { id: true, name: true } } },
      },
      accesses: true,
      services: {
        orderBy: { createdAt: "desc" },
        include: { client: { select: { id: true, name: true } } },
      },
    },
  });

  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await withMedia(client, "client"));
}

export async function PATCH(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (body.contractStartDate) body.contractStartDate = new Date(body.contractStartDate);
  if (body.renewalDate) body.renewalDate = new Date(body.renewalDate);

  // O logo só muda por /api/clients/[id]/logo; aqui ele chegaria como link e sobrescreveria a imagem.
  delete body.logoUrl;
  const client = await prisma.client.update({
    where: { id: params.id },
    data: body,
    omit: { logoUrl: true },
  });

  return NextResponse.json(await withMedia(client, "client"));
}

export async function DELETE(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.client.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
