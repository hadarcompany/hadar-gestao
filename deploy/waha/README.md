# WAHA para o WhatsApp da Hadar

Este serviço mantém a sessão do WhatsApp e precisa rodar continuamente em uma
VPS ou host Docker. A Vercel continua hospedando somente o app.

Variáveis do arquivo `.env` ao lado do compose:

```env
WAHA_API_KEY_SHA512=<sha512 da chave escolhida>
WHATSAPP_HOOK_URL=https://gestao.agenciahadar.com.br/api/webhooks/whatsapp?token=<WAHA_WEBHOOK_TOKEN>
```

Suba com `docker compose up -d`. Na Vercel, cadastre a versão em texto puro da
chave em `WAHA_API_KEY`, a URL pública do WAHA em `WAHA_API_BASE_URL`, o mesmo
token em `WAHA_WEBHOOK_TOKEN` e `WAHA_SESSION_NAME=hadar`.
