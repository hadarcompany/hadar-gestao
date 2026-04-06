import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  return NextResponse.json({
    totalMRR,
    totalFreelancer,
    recurringServices,
    freelancerServices,
  });
}
