# Integração Asaas

## Implantação na Vercel

1. Envie o código desta integração para a branch usada em Produção pela Vercel.
2. No projeto da Vercel, abra **Settings > Environment Variables**.
3. Cadastre `ASAAS_ENVIRONMENT`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `ASAAS_USER_AGENT` no ambiente correto.
4. Aplique a migration com `npx prisma migrate deploy` usando as variáveis do ambiente de Produção.
5. Faça um novo deploy; variáveis novas não entram em deployments antigos.
6. Só depois do deploy cadastre o Webhook no Asaas, usando o domínio canônico do app e sem redirecionamentos.
7. Abra **Financeiro > Cobranças**, selecione o mês e execute **Sincronizar Asaas** para fazer a conciliação inicial.

O Dashboard Financeiro, as metas de faturamento e o pró-labore consideram somente cobranças com ID confirmado pelo Asaas. Valores previstos seguem o vencimento; valores recebidos seguem a data real do pagamento.

## 1. Homologação em Sandbox

Crie uma conta em `https://sandbox.asaas.com` e gere uma chave em **Integrações > Chaves de API**.

Configure no ambiente do servidor:

```env
ASAAS_ENVIRONMENT=sandbox
ASAAS_API_KEY=$aact_hmlg_...
ASAAS_WEBHOOK_TOKEN=um_token_aleatorio_seguro_com_32_a_255_caracteres
ASAAS_USER_AGENT=HadarGestao/1.0
```

Nunca use a chave no frontend ou em variáveis `NEXT_PUBLIC_*`.

## 2. Banco de dados

Aplique a migration antes de abrir a aba Cobranças:

```bash
npx prisma migrate deploy
```

## 3. Webhook

No Asaas, cadastre um Webhook sequencial com:

- URL: `https://SEU-DOMINIO/api/webhooks/asaas`
- Token de autenticação: o mesmo valor de `ASAAS_WEBHOOK_TOKEN`
- Eventos: `PAYMENT_CREATED`, `PAYMENT_UPDATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_RESTORED`, `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_RECEIVED_IN_CASH_UNDONE` e eventos de chargeback aplicáveis.

O endpoint valida o header `asaas-access-token` e grava o ID de cada evento para impedir processamento duplicado.

## 4. Produção

Depois de validar criação, pagamento, atraso e reenvio de Webhook no Sandbox:

```env
ASAAS_ENVIRONMENT=production
ASAAS_API_KEY=$aact_prod_...
```

As chaves de Sandbox e Produção são diferentes. Mantenha o token do Webhook separado da chave da API.
