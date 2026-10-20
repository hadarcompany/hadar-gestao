import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  socialAuth,
  failure,
  SocialError,
  unseal,
  seal,
} from "@/lib/social/core";
import type { PageCandidate } from "@/lib/social/meta";

async function pending(id: unknown, userId: string) {
  if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id))
    throw new SocialError("Conexão inválida.");
  const row = await prisma.socialOAuthSession.findUnique({ where: { id } });
  if (
    !row ||
    row.userId !== userId ||
    row.provider !== "FACEBOOK" ||
    row.expiresAt <= new Date() ||
    !row.resultEncrypted
  )
    throw new SocialError(
      "A autorização venceu. Clique em Conectar Facebook novamente.",
      409,
    );
  const data = JSON.parse(unseal(row.resultEncrypted)) as {
    pages: PageCandidate[];
    expiresAt: string;
  };
  return { row, data };
}
export async function GET(req: Request) {
  const access = await socialAuth(req, "/api/social/selection");
  if (access.response) return access.response;
  try {
    const { row, data } = await pending(
      new URL(req.url).searchParams.get("session"),
      access.auth!.id,
    );
    return NextResponse.json({
      clientId: row.clientId,
      pages: data.pages.map(({ id, name }) => ({ id, name })),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(req: Request) {
  const access = await socialAuth(req, "/api/social/selection");
  if (access.response) return access.response;
  try {
    const body = await req.json(),
      { row, data } = await pending(body.session, access.auth!.id);
    if (
      !Array.isArray(body.pageIds) ||
      body.pageIds.length < 1 ||
      body.pageIds.length > 50
    )
      throw new SocialError("Selecione as páginas deste cliente.");
    const ids = [...new Set<string>(body.pageIds)];
    const pages = ids.map((id) => data.pages.find((p) => p.id === id));
    if (pages.some((p) => !p))
      throw new SocialError("Página fora da autorização.", 403);
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.socialOAuthSession.deleteMany({
        where: {
          id: row.id,
          userId: access.auth!.id,
          expiresAt: { gt: new Date() },
        },
      });
      if (!consumed.count)
        throw new SocialError("Esta autorização já foi utilizada.", 409);
      for (const page of pages) {
        const existing = await tx.socialAccount.findUnique({
          where: {
            provider_externalId: { provider: "FACEBOOK", externalId: page!.id },
          },
        });
        if (existing && existing.clientId !== row.clientId)
          throw new SocialError(
            "Uma página selecionada já está vinculada a outro cliente.",
            409,
          );
        const record = {
          clientId: row.clientId,
          name: page!.name,
          tokenEncrypted: seal(page!.token),
          tokenExpiresAt: new Date(data.expiresAt),
          tokenRefreshedAt: new Date(),
          status: "CONNECTED",
          connectedById: access.auth!.id,
        };
        const { clientId: _owner, ...update } = record;
        const saved = await tx.socialAccount.upsert({
          where: {
            provider_externalId: { provider: "FACEBOOK", externalId: page!.id },
          },
          create: { ...record, provider: "FACEBOOK", externalId: page!.id },
          update,
        });
        if (saved.clientId !== row.clientId)
          throw new SocialError("Uma página já pertence a outro cliente.", 409);
      }
    });
    return NextResponse.json({ connected: pages.length });
  } catch (error) {
    return failure(error);
  }
}
