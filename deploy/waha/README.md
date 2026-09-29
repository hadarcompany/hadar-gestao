# WAHA para o WhatsApp da Hadar

Este é o provedor alternativo por QR Code. A aplicação continua na Vercel e o
WAHA/Caddy ficam na VPS. A porta 3000 não é publicada; somente HTTPS 443 e HTTP
80 ficam acessíveis.

1. Copie `.env.example` para `.env` e gere valores seguros.
2. Aponte `waha.agenciahadar.com.br` para a VPS.
3. Execute `docker compose up -d`.
4. Na Vercel, use:

```env
WHATSAPP_PROVIDER=WAHA
WAHA_API_BASE_URL=https://waha.agenciahadar.com.br
WAHA_API_KEY=<mesmo WAHA_API_KEY da VPS>
WAHA_SESSION_NAME=hadar
WAHA_WEBHOOK_TOKEN=<mesmo WAHA_WEBHOOK_TOKEN da VPS>
```

Para usar a Cloud API oficial no futuro, altere somente `WHATSAPP_PROVIDER` e
adicione as variáveis `META_WHATSAPP_*`; os dados locais de conversas são
preservados.
