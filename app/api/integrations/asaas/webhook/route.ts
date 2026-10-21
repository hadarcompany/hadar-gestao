import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { guardApiRequest } from "@/lib/api-guard";
import {
  getAsaasRuntimeConfig,
  getAsaasWebhookToken,
} from "@/lib/asaas-integration-server";
import { requestAsaasWithConfig } from "@/lib/asaas";
import { publicOrigin } from "@/lib/public-url";

export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };
const events = [
  "PAYMENT_CREATED",
  "PAYMENT_UPDATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_RESTORED",
  "PAYMENT_RECEIVED_IN_CASH_UNDONE",
];

/** Register only this instance's callback, using the existing integration secrets. */
export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth)
    return NextResponse.json(
      { error: "Entre na sua conta." },
      { status: 401, headers },
    );
  const denied = await guardApiRequest(
    auth,
    req,
    "/api/integrations/asaas/webhook",
  );
  if (denied) return denied;
  const input = await req.text();
  if (input.length > 2048)
    return NextResponse.json(
      { error: "Configuração muito longa." },
      { status: 400, headers },
    );
  let email: string;
  try {
    const body = JSON.parse(input);
    if (
      !body ||
      Object.keys(body).some((key) => key !== "email") ||
      typeof body.email !== "string"
    )
      throw Error();
    email = body.email.trim();
    if (email.length > 254 || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email))
      throw Error();
  } catch {
    return NextResponse.json(
      { error: "Informe um e-mail para os avisos técnicos." },
      { status: 400, headers },
    );
  }
  try {
    const config = await getAsaasRuntimeConfig(),
      token = await getAsaasWebhookToken();
    if (!token || token.length < 32 || token.length > 255)
      return NextResponse.json(
        {
          error: "Configure um token válido para o webhook antes de ativá-lo.",
        },
        { status: 409, headers },
      );
    const url = new URL("/api/webhooks/asaas", publicOrigin(req.url)).href;
    const remote = await requestAsaasWithConfig<{
      data: { id: string; url: string }[];
    }>(config, "/webhooks?limit=100", { signal: AbortSignal.timeout(8000) });
    const existing = remote.data.find((item) => item.url === url);
    const data = {
      name: "Gestão - sincronização de cobranças",
      url,
      email,
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      authToken: token,
      sendType: "SEQUENTIALLY",
      events,
    };
    await requestAsaasWithConfig(
      config,
      existing ? `/webhooks/${encodeURIComponent(existing.id)}` : "/webhooks",
      {
        method: existing ? "PUT" : "POST",
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(10000),
      },
    );
    // Provider responses can include authToken: never forward them to the browser.
    return NextResponse.json(
      { configured: true, url, email, events },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Não foi possível ativar o webhook no Asaas. Confira a integração e tente novamente.",
      },
      { status: 502, headers },
    );
  }
}
