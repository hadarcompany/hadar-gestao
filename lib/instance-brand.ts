export type InstanceBrand = "hadar" | "insider";
export function instanceBrand(): InstanceBrand {
  return process.env.INSTANCE_BRAND === "insider" ? "insider" : "hadar";
}
