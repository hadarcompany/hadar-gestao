import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await prisma.client.findUnique({
    where: { id: params.id },
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
  return NextResponse.json(client);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (body.contractStartDate) body.contractStartDate = new Date(body.contractStartDate);
  if (body.renewalDate) body.renewalDate = new Date(body.renewalDate);

  const client = await prisma.client.update({
    where: { id: params.id },
    data: body,
  });

  return NextResponse.json(client);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.client.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
