import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { DELIVERY_TYPES } from "@/lib/delivery-types";

/** Demanda semanal atualmente vigente (effectiveTo null) por tipo de entrega. */
export async function GET(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.clientWeeklyDemand.findMany({
    where: { clientId: params.id, effectiveTo: null },
  });

  const current = DELIVERY_TYPES.map((dt) => ({
    deliveryType: dt.value,
    label: dt.label,
    quantity: rows.find((r) => r.deliveryType === dt.value)?.quantity ?? 0,
    configured: rows.some((r) => r.deliveryType === dt.value),
  }));

  return NextResponse.json({ current, hasAnyDemand: rows.length > 0 });
}

/**
 * Substitui a demanda vigente por um novo conjunto {deliveryType, quantity}. Não edita
 * linhas antigas: encerra a vigência atual (effectiveTo=now) e cria uma nova linha, para
 * que a avaliação de semanas passadas nunca mude retroativamente.
 */
export async function PUT(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const entries: Array<{ deliveryType: string; quantity: number }> = Array.isArray(body.entries) ? body.entries : [];

  const now = new Date();
  const active = await prisma.clientWeeklyDemand.findMany({ where: { clientId: params.id, effectiveTo: null } });

  const ops = [];
  for (const dt of DELIVERY_TYPES) {
    const entry = entries.find((e) => e.deliveryType === dt.value);
    const newQty = entry && entry.quantity > 0 ? Math.floor(entry.quantity) : 0;
    const currentRow = active.find((r) => r.deliveryType === dt.value);
    const currentQty = currentRow?.quantity ?? 0;

    if (newQty === currentQty) continue; // nada mudou para este tipo

    if (currentRow) {
      ops.push(prisma.clientWeeklyDemand.update({ where: { id: currentRow.id }, data: { effectiveTo: now } }));
    }
    if (newQty > 0) {
      ops.push(
        prisma.clientWeeklyDemand.create({
          data: { clientId: params.id, deliveryType: dt.value, quantity: newQty, effectiveFrom: now, createdById: auth.id },
        })
      );
    }
  }

  if (ops.length > 0) await prisma.$transaction(ops);

  const rows = await prisma.clientWeeklyDemand.findMany({ where: { clientId: params.id, effectiveTo: null } });
  return NextResponse.json({
    current: DELIVERY_TYPES.map((dt) => ({
      deliveryType: dt.value,
      label: dt.label,
      quantity: rows.find((r) => r.deliveryType === dt.value)?.quantity ?? 0,
      configured: rows.some((r) => r.deliveryType === dt.value),
    })),
  });
}
