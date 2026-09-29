# Meta Ads e WhatsApp Cloud API

## Meta Ads (somente leitura)

Crie um aplicativo empresarial em Meta for Developers, adicione Marketing API
e configure exatamente esta URI de redirecionamento:

`https://gestao.agenciahadar.com.br/api/meta/callback`

Variáveis na Vercel (Production):

```env
META_APP_ID=
META_APP_SECRET=
META_GRAPH_API_VERSION=v26.0
META_OAUTH_REDIRECT_URI=https://gestao.agenciahadar.com.br/api/meta/callback
META_TOKEN_ENCRYPTION_KEY=<segredo aleatório com pelo menos 32 caracteres>
```

Depois do redeploy, um administrador abre Configurações > Integrações e usa
"Conectar com a Meta". O OAuth solicita `ads_read` e `business_management`.
Cada conta descoberta pode ser vinculada a um cliente na tela Meta Ads.

Tokens são criptografados com AES-256-GCM antes de serem salvos no banco.

## WhatsApp oficial (opcional)

O WAHA permanece como padrão. Para migrar, configure a Cloud API e seu webhook:

- Callback: `https://gestao.agenciahadar.com.br/api/webhooks/meta/whatsapp`
- Verify token: o mesmo valor de `META_WHATSAPP_VERIFY_TOKEN`
- Campo de assinatura: `messages`

Variáveis na Vercel:

```env
WHATSAPP_PROVIDER=META_CLOUD
META_WHATSAPP_ACCESS_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_WABA_ID=
META_WHATSAPP_VERIFY_TOKEN=<segredo aleatório>
META_WHATSAPP_DISPLAY_NAME=Hadar
```

`META_APP_SECRET` também é usado para validar `X-Hub-Signature-256` em todos os
POSTs do webhook. Faça a migração primeiro com um número de teste. Para voltar
ao QR Code sem apagar conversas, defina `WHATSAPP_PROVIDER=WAHA` e redeploye.

## Classificação automática dos contatos

Ao receber uma mensagem, o telefone é comparado nesta ordem:

1. cliente cadastrado;
2. lead já existente no pipeline;
3. nenhum dos dois: cria novo lead na etapa `NOVO`, origem `WhatsApp`.

Assim, um cliente não vira lead duplicado. A tela identifica visualmente
cliente existente, lead existente e novo lead criado.
