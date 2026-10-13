import type { NextRequest } from "next/server";
import { AssistantError } from "./types";
import { validMutationOrigin } from "../api-policy";

export function checkAssistantOrigin(req: NextRequest) {
  if (!validMutationOrigin(req)) throw new AssistantError("Origem da requisição inválida.", 403);
}
