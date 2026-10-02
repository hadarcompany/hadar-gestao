import type { NextRequest } from "next/server";
import { AssistantError } from "./types";

export function checkAssistantOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) throw new AssistantError("Origem da requisição inválida.", 403);
}
