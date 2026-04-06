import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const interaction = await prisma.interaction.create({
    data: {
      type: body.type,
      content: body.content,
      clientId: params.id,
      authorId: session.user.id,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  return NextResponse.json(interaction, { status: 201 });
}
