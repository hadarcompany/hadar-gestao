import { Avatar } from "@/components/ui/avatar";
import type { ClientSummary } from "@/lib/types";

export function ClientIdentity({ client, size = 20 }: { client: Pick<ClientSummary, "name" | "logoUrl">; size?: number }) {
  return <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 align-middle">
    <Avatar name={client.name} image={client.logoUrl} size={size} className="object-contain" />
    <span className="truncate">{client.name}</span>
  </span>;
}
