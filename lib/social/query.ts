import { Prisma } from "@prisma/client";
import { requireClient, SocialError } from "./core";
import { dayDate } from "./schedule";
export async function editorialFilter(
  q: URLSearchParams,
): Promise<Prisma.SocialPostWhereInput> {
  const client = q.get("clientId"),
    month = q.get("month"),
    day = q.get("day"),
    status = q.get("status"),
    provider = q.get("provider"),
    format = q.get("format");
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new SocialError("Mês inválido.");
  const start = day
    ? new Date(dayDate(day) + "T00:00:00-03:00")
    : month
      ? new Date(`${month}-01T00:00:00-03:00`)
      : null;
  const end = start
    ? day
      ? new Date(start.getTime() + 86400000)
      : new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 3),
        )
    : null;
  if (
    status &&
    status !== "ALL" &&
    ![
      "DRAFT",
      "PENDING_APPROVAL",
      "SCHEDULED",
      "PROCESSING",
      "PUBLISHED",
      "FAILED",
      "CANCELLED",
      "UNCERTAIN",
    ].includes(status)
  )
    throw new SocialError("Situação inválida.");
  if (
    provider &&
    provider !== "ALL" &&
    !["INSTAGRAM", "FACEBOOK"].includes(provider)
  )
    throw new SocialError("Rede inválida.");
  if (
    format &&
    format !== "ALL" &&
    !["POST", "CAROUSEL", "REEL", "STORY"].includes(format)
  )
    throw new SocialError("Canal inválido.");
  return {
    ...(client === "all" ? {} : { clientId: await requireClient(client) }),
    ...(start && end
      ? {
          OR: [
            { scheduledAt: { gte: start, lt: end } },
            { scheduledAt: null, createdAt: { gte: start, lt: end } },
          ],
        }
      : {}),
    ...(status && status !== "ALL" ? { status } : {}),
    ...(provider && provider !== "ALL" ? { account: { provider } } : {}),
    ...(format && format !== "ALL"
      ? { format: format === "POST" ? { in: ["POST", "CAROUSEL"] } : format }
      : {}),
  };
}
