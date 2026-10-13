import { prisma } from "./prisma";
import { asaasIntegrationStatus, asaasRuntimeConfig, asaasWebhookToken } from "./asaas-integration";

export async function getAsaasConfig() { return asaasIntegrationStatus(await prisma.asaasIntegration.findUnique({ where: { id: "primary" } })); }
export async function getAsaasRuntimeConfig() { return asaasRuntimeConfig(await prisma.asaasIntegration.findUnique({ where: { id: "primary" } })); }
export async function getAsaasWebhookToken() { return asaasWebhookToken(await prisma.asaasIntegration.findUnique({ where: { id: "primary" } })); }
