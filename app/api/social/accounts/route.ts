import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  socialAuth,
  failure,
  requireClient,
  SocialError,
} from "@/lib/social/core";
export async function GET(req: Request) {
  // Viewing names needs module access; connecting/disconnecting is admin-only.
  const access = await socialAuth(req, "/api/social/posts");
  if (access.response) return access.response;
  try {
    const clientId = await requireClient(
      new URL(req.url).searchParams.get("clientId"),
    );
    const rows = await prisma.socialAccount.findMany({
      where: { clientId },
      select: {
        id: true,
        provider: true,
        externalId: true,
        name: true,
        accountType: true,
        status: true,
        tokenExpiresAt: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(rows);
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(req: Request) {
  const access = await socialAuth(req, "/api/social/accounts");
  if (access.response) return access.response;
  try {
    const body = await req.json(),
      clientId = await requireClient(body.clientId);
    // Keep publication history and refuse races with a publish already in flight.
    await prisma.$transaction(async (tx) => {
      const account = await tx.socialAccount.updateMany({
        where: { id: String(body.id), clientId },
        data: { status: "DISCONNECTING" },
      });
      if (!account.count) throw new Error("AccountNotFound");
      if (
        await tx.socialPost.count({
          where: {
            accountId: String(body.id),
            OR: [
              { status: "PROCESSING" },
              { status: "SCHEDULED", publishStartedAt: { not: null } },
            ],
          },
        })
      )
        throw new SocialError(
          "Há uma publicação em processamento. Aguarde antes de desconectar.",
          409,
        );
      await tx.socialPost.updateMany({
        where: {
          accountId: String(body.id),
          status: { in: ["DRAFT", "PENDING_APPROVAL", "SCHEDULED", "FAILED"] },
        },
        data: { status: "CANCELLED" },
      });
      await tx.socialAccount.update({
        where: { id: String(body.id) },
        data: { status: "DISCONNECTED", tokenEncrypted: "" },
      });
      await tx.socialSeries.updateMany({
        where: { accountId: String(body.id), active: true },
        data: { active: false },
      });
    });
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    return failure(error);
  }
}
