import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { paymentUpdateData, type AsaasPayment } from "../lib/asaas";
import { loadRouteModule } from "./helpers/route-module";

const payment: AsaasPayment = {
  id: "pay_test",
  customer: "cus_test",
  value: 1097,
  billingType: "PIX",
  status: "PENDING",
  dueDate: "2026-10-30",
};
const previousPaidDate = new Date("2026-10-02T00:00:00Z");
test("conciliação acompanha remarcação e pagamento sem alterar competência manual", () => {
  const data = paymentUpdateData(payment);
  assert.equal(data.dueDate.toISOString(), "2026-10-30T00:00:00.000Z");
  assert.equal(data.amount, 1097);
  assert.equal(data.month, 10);
  assert.equal(data.year, 2026);
  assert.equal("revenueCompetenceMonth" in data, false);
  for (const status of ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]) {
    const paid = paymentUpdateData({ ...payment, status }, previousPaidDate);
    assert.equal(paid.status, "PAID");
    assert.equal(paid.paidDate, previousPaidDate);
  }
  assert.equal(
    paymentUpdateData({
      ...payment,
      status: "RECEIVED",
      paymentDate: "2026-10-20",
    }).paidDate?.toISOString(),
    "2026-10-20T00:00:00.000Z",
  );
  assert.equal(
    paymentUpdateData({ ...payment, deleted: true }).asaasStatus,
    "DELETED",
  );
  for (const dueDate of ["2026-02-30", "invalid"])
    assert.throws(() => paymentUpdateData({ ...payment, dueDate }));
});

test("falha no provedor preserva cobrança; resposta concorrente não sobrescreve webhook", async () => {
  const writes: any[] = [];
  const { reconcileAsaasCharges } = loadRouteModule(
    "lib/asaas-reconciliation.ts",
    {
      "./prisma": {
        prisma: {
          receivable: {
            findMany: async () =>
              ["failed", "paid", "conflict"].map((id) => ({
                id,
                asaasPaymentId: id,
                asaasSyncedAt: null,
                paidDate: previousPaidDate,
              })),
            count: async () => 3,
            updateMany: async (args: any) => {
              writes.push(args);
              return { count: args.where.id === "conflict" ? 0 : 1 };
            },
          },
        },
      },
      "./asaas": {
        getAsaasConfig: async () => ({ configured: true }),
        getAsaasPayment: async (id: string) => {
          if (id === "failed") throw Error("private API secret");
          return { ...payment, id, status: "RECEIVED" };
        },
        paymentUpdateData,
      },
    },
  );
  const result = await reconcileAsaasCharges({ force: true });
  assert.equal(result.failed, 1);
  assert.equal(result.updated, 1);
  assert.equal(result.conflicts, 1);
  const failed = writes.find((item) => item.where.id === "failed");
  assert.equal(Object.keys(failed.data).join(), "asaasSyncError");
  assert.ok(!failed.data.asaasSyncError.includes("private"));
  assert.equal(
    writes.find((item) => item.where.id === "conflict").where.asaasSyncedAt,
    null,
  );
});

test("webhook atrasado consulta estado atual e não reabre cobrança paga", async () => {
  let duplicate = false, write: any, conflict=false,lookedUp=false;
  const local = { id: "rec_test", asaasSyncedAt: null, paidDate: null };
  const db: any = {
    asaasWebhookEvent: {
      findUnique: async () => (duplicate ? { id: "event_test" } : null),
      create: async () => {
        duplicate = true;
      },
    },
    receivable: {
      findFirst: async () => local,
      updateMany: async (args: any) => {
        write = args;
        return { count: conflict?0:1 };
      },
      findUnique: async () => {lookedUp=true;return ({
        id: local.id,
        clientId: "client_test",
        client: { name: "Cliente" },
      });},
    },
    user: { findMany: async () => [] },
  };
  db.$transaction = async (fn: any) => fn(db);
  const { POST } = loadRouteModule("app/api/webhooks/asaas/route.ts", {
    "@/lib/prisma": { prisma: db },
    "@/lib/asaas": {
      paymentUpdateData,
      getAsaasPayment: async () => ({
        ...payment,
        status: "RECEIVED",
        paymentDate: "2026-10-20",
      }),
    },
    "@/lib/asaas-integration-server": {
      getAsaasWebhookToken: async () => "test-token",
    },
    "@/lib/asaas-integration": {
      validAsaasWebhookToken: (expected: string, received: string) =>
        expected === received,
    },
  });
  const req = () =>
    new NextRequest("https://example.test/api/webhooks/asaas", {
      method: "POST",
      headers: { "asaas-access-token": "test-token" },
      body: JSON.stringify({
        id: "event_test",
        event: "PAYMENT_OVERDUE",
        payment: { ...payment, status: "OVERDUE" },
      }),
    });
  assert.equal((await POST(req())).status, 200);
  assert.equal(write.data.status, "PAID");
  assert.equal(write.where.asaasSyncedAt, null);
  assert.equal((await (await POST(req())).json()).duplicate, true);
  duplicate=false;conflict=true;lookedUp=false;
  assert.equal((await POST(req())).status,200);
  assert.equal(lookedUp,false,"Uma resposta que perdeu a comparação não atualiza nem notifica");
  const denied = await POST(
    new NextRequest("https://example.test/api/webhooks/asaas", {
      method: "POST",
      body: "{}",
    }),
  );
  assert.equal(denied.status, 401);
});

test("sincronização manual exige sessão, edição financeira e origem válida", async () => {
  const admin = { id: "admin", role: "ADMIN", permissions: null };
  let called = false;
  const make = (user: any) =>
    loadRouteModule("app/api/asaas/reconcile/route.ts", {
      "@/lib/supabase/get-server-auth": { getServerAuth: async () => user },
      "@/lib/asaas-reconciliation": {
        reconcileAsaasCharges: async () => {
          called = true;
          return { configured: true };
        },
      },
    });
  const req = (origin = "https://example.test") =>
    new NextRequest("https://example.test/api/asaas/reconcile", {
      method: "POST",
      headers: { origin },
    });
  const saved = process.env.APP_URL;
  process.env.APP_URL = "https://example.test";
  try {
    assert.equal((await make(null).POST(req())).status, 401);
    assert.equal(
      (
        await make({
          ...admin,
          role: "MEMBER",
          permissions: { financeiro: "view" },
        }).POST(req())
      ).status,
      403,
    );
    assert.equal(
      (await make(admin).POST(req("https://attacker.test"))).status,
      403,
    );
    assert.equal(called, false);
    assert.equal((await make(admin).POST(req())).status, 200);
    assert.equal(called, true);
  } finally {
    if (saved === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = saved;
  }
});
