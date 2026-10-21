# Relatórios de redes sociais

Em Publicações > Relatórios, selecione o cliente e um intervalo de até 30 dias.
O relatório tem resumo, seguidores, demografia, Stories, Reels, Posts, horários,
CSV completo e impressão de todas as seções (o navegador permite salvar PDF).

## O que cada número significa

- Resumo: totais de conta no intervalo, que podem incluir anúncios. Engajamento
  é o número de contas engajadas; taxa = contas engajadas / alcance × 100.
- Frequência de visualização = views / alcance. Usa a métrica views atual da Meta,
  não a antiga métrica impressions. Não equivale à frequência de anúncios.
- Seguidores atuais são a contagem no momento da consulta. Crescimento observado
  compara apenas contagens coletadas, com as datas da comparação visíveis.
- Novos seguidores e saídas são fornecidos pela Meta; o coletor atualiza os dois
  últimos dias e preenche um dia anterior por ciclo, até 30 dias quando disponível.
  Não reconstrói a contagem histórica total de seguidores.
- Demografia usa a janela própria `this_month` da Meta (últimos 30 dias na consulta),
  independentemente do filtro. Há gênero, idade por gênero, país e cidade. A API
  pode ocultar amostras pequenas; a soma não precisa coincidir com o total de seguidores.
- Rankings: mídias publicadas nas datas escolhidas, métricas acumuladas até sua
  última coleta. Top 20 é apenas a lista; totais e médias incluem todo o conjunto
  coletado, limitado a 1.000 mídias por consulta. Cobertura parcial fica explícita.
  Alcance de mídias não é somado como alcance único da conta.
- Engajamento de cada mídia = interações / alcance × 100. Médias ignoram ausências;
  zero retornado pela API continua sendo zero. Dados ausentes aparecem indisponíveis.
- Horários comparam médias observadas por dia/hora de Brasília. Só destacam células
  com ao menos três mídias; não usam recomendações de mercado ou promessas causais.

As métricas de mídias nesta conexão são principalmente orgânicas; podem diferir
dos totais da conta e de relatórios de anúncios. A Meta pode atrasar dados por até 48h.
Cache de relatório: 30 minutos. A renovação de autorização já limpa esse cache.

## Coleta e Stories

O endpoint privado `POST /api/social/analytics/worker` usa o mesmo segredo de worker
da instância, sem sessão de navegador, e só lê a Meta. Não depende da flag de
publicação. O teste vencido interrompe a coleta. A seleção considera apenas contas
conectadas; desconectar interrompe novos ciclos.

`hadar-analytics@hadar.timer` dispara a cada minuto; o banco limita a conta a um
ciclo por 15 minutos e usa lease atômico para evitar coletas simultâneas. Um ciclo
descobre até 200 Stories ativos e 200 mídias recentes, atualiza até 20 Stories e
oito mídias de Feed, com orçamento global de requisições e backoff. Volumes maiores
podem gerar cobertura incompleta. Mídias até 90 dias são atualizadas em rodízio;
as mais antigas, até o limite de dois anos, recebem tentativa inicial em lotes.
Falhas preservam métricas anteriores; a tentativa e a última coleta bem-sucedida
são registradas separadamente. Cada conta conectada recebe seus próprios dados.

Stories precisam ser vistos pelo coletor durante a janela disponível na Meta.
O arquivo preserva métricas e referências após a expiração; não guarda imagens
nem vídeos novos. Miniaturas hospedadas pela Meta podem expirar. Stories antigos
sem coleta, reshares e números finais após a janela não têm cobertura garantida.
O login direto do Instagram não oferece webhook de story_insights.

Concorrentes: a conexão atual não oferece métricas privadas nem Business Discovery
de terceiros. A seção explica a limitação; não simula uma análise. Facebook
avançado continua dependendo de read_insights, não solicitado nesta atualização.

## Instalação

1. Backup com restauração verificada.
2. Executar `scripts/prepare-social.ts --project-ref=REF --apply` com a credencial
   administrativa da instância. A migração `20261021190000_social_analytics` é aditiva:
   três tabelas com RLS e políticas para o runtime Hadar existente. Sem db push/seed.
3. Fazer deploy do código. As chaves de Meta, Asaas, criptografia e mídias permanecem.
4. Atualizar `deploy/social/worker.py` na pasta operacional da VPS e instalar os
   dois units `hadar-analytics@.service/.timer`. Usam o JSON privado já existente
   com `--analytics`; não precisam de um novo segredo. Habilitar só na instância
   que recebeu schema e código novos. Insider exige atualização própria.
5. Conferir coleta, respostas não autorizadas e o relatório na interface.

`npm run test:social:analytics:db` exige TEST_DATABASE_URL de uma base PostgreSQL
local descartável social_test_* ou social_preview_*. Aplica a migração em teste,
verifica RLS, lease concorrente, preservação de Stories, nulos/zeros, cache e
escopo de conta com chamadas Meta simuladas. Nunca publica conteúdo.

Referências oficiais consultadas em 21/10/2026:
- https://developers.facebook.com/documentation/instagram-platform/api-reference/instagram-user/insights
- https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights
