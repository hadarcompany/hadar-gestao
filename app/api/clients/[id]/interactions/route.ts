import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const interaction = await prisma.interaction.create({
    data: {
      type: body.type,
      content: body.content,
      clientId: params.id,
      authorId: auth.id,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  return NextResponse.json(interaction, { status: 201 });
}
