import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Fotos de usuário e logos de cliente ficam no banco como data URLs base64.
 * Embutidas nas listas, elas se repetem em cada tarefa/registro e estouram o
 * limite de resposta da Vercel (4,5 MB) — com três fotos, a lista de tarefas
 * passou de 800 MB. Por isso as consultas não buscam esses campos: aqui eles
 * viram links para as rotas que servem a imagem, versionados para cache.
 */

type MediaKind = "user" | "client";

const KIND_BY_KEY = new Map<string, MediaKind>([
  ["user", "user"],
  ["owner", "user"],
  ["author", "user"],
  ["client", "client"],
]);

export async function loadMediaIndex() {
  const [users, clients] = await Promise.all([
    prisma.user.findMany({ where: { image: { not: null } }, select: { id: true, updatedAt: true } }),
    prisma.client.findMany({ where: { logoUrl: { not: null } }, select: { id: true, updatedAt: true } }),
  ]);
  const avatars = new Map(users.map((u) => [u.id, `/api/users/${u.id}/avatar?v=${u.updatedAt.getTime()}`]));
  const logos = new Map(clients.map((c) => [c.id, `/api/clients/${c.id}/logo?v=${c.updatedAt.getTime()}`]));
  return {
    avatar: (id: string) => avatars.get(id) ?? null,
    logo: (id: string) => logos.get(id) ?? null,
  };
}

export type MediaIndex = Awaited<ReturnType<typeof loadMediaIndex>>;

/** Preenche `image` (usuários) e `logoUrl` (clientes) com links. Cada objeto é
 * reconhecido pela chave onde aparece (user/owner/author/client) ou pelo `root`. */
export function applyMedia<T>(data: T, media: MediaIndex, root?: MediaKind): T {
  return walk(data, media, root) as T;
}

export async function withMedia<T>(data: T, root?: MediaKind): Promise<T> {
  return applyMedia(data, await loadMediaIndex(), root);
}

function walk(node: unknown, media: MediaIndex, kind?: MediaKind): unknown {
  if (Array.isArray(node)) return node.map((item) => walk(item, media, kind));
  if (node === null || typeof node !== "object" || node instanceof Date) return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) out[key] = walk(value, media, KIND_BY_KEY.get(key));
  if (typeof out.id === "string") {
    if (kind === "user") out.image = media.avatar(out.id);
    if (kind === "client") out.logoUrl = media.logo(out.id);
  }
  return out;
}

/** Devolve como arquivo o conteúdo de um data URL guardado no banco. */
export function dataUrlResponse(value: string | null | undefined): NextResponse {
  if (!value) return new NextResponse(null, { status: 404 });
  if (/^https?:\/\//.test(value)) return NextResponse.redirect(value);
  const match = /^data:([^;,]+)?(?:;[^;,=]+=[^;,]+)*(;base64)?,([\s\S]*)$/.exec(value);
  if (!match) return new NextResponse(null, { status: 404 });
  const [, mime = "application/octet-stream", base64, payload] = match;
  const bytes = base64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload));
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      // O link já carrega a versão (?v=updatedAt): trocar a imagem gera outro endereço.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
