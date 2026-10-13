import { NextRequest } from "next/server";
import { guardApiRequest } from "@/lib/api-guard";
import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";
import { canView } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/financeiro");
  if (denied) return denied;
  if (!canView(auth, "financeiro")) return NextResponse.json({ error: "Sem acesso ao financeiro." }, { status: 403 });

  const recurringServices = await prisma.service.findMany({
    where: { type: "RECURRING" },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const totalMRR = recurringServices.reduce((sum, s) => sum + (s.monthlyValue || 0), 0);

  const freelancerServices = await prisma.service.findMany({
    where: { type: "FREELANCER" },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const totalFreelancer = freelancerServices.reduce((sum, s) => sum + (s.totalValue || 0), 0);

  return NextResponse.json(await withMedia({
    totalMRR,
    totalFreelancer,
    recurringServices,
    freelancerServices,
  }));
}
