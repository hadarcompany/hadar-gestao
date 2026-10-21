# Editor de publicações

O editor trabalha por cliente e por canal de cada conta conectada. Instagram e
Facebook oferecem Post, Reels e Stories; duas ou mais imagens JPEG em Post viram
carrossel automaticamente. Reels e Stories recebem um arquivo por publicação.

## Programação e aprovação opcional

- **Datas manuais:** até 60 datas por envio. Cada dia novo recebe o horário padrão;
  ajustar um horário não altera os demais. “Aplicar a todas as datas” é explícito.
- **Semanal:** dias da semana, horário, início e término opcional. Sem término,
  continua até o administrador pausar. O worker mantém uma janela de 60 dias;
  chave única por série e ocorrência impede duplicação em execuções concorrentes.
- **Agendar diretamente:** administrador pode salvar uma programação já liberada,
  sem aprovação do cliente. **Publicar agora** envia uma cópia para o próximo
  ciclo do worker, normalmente em até um minuto; não cria repetição.
- **Enviar para aprovação:** opção para manter o conteúdo pendente no Gestão.
  Não envia mensagem, e-mail ou link de aprovação automaticamente ao cliente.
- Editar uma ocorrência não altera a série. Pausar cancela somente ocorrências
  ainda não iniciadas; para reiniciar, uma nova série deve ser revisada.
- “Usar como nova” reaproveita o conteúdo disponível em outra programação.

O fuso é America/Sao_Paulo. O publicador precisa de
`SOCIAL_PUBLISHING_ENABLED=true` e heartbeat recente. A atualização não liga essa
flag e não publica os conteúdos que estavam pendentes.

## Imagens e opções

Prévia de Feed/carrossel e de Stories/Reels; a renderização final é da rede social.
Editor de imagens com até cinco textos, posição, cor, tamanho e corte central
original, quadrado ou 9:16; exporta uma nova imagem JPEG e preserva o original.
Reel do Instagram aceita capa JPEG separada ou quadro escolhido do vídeo.

Opções do Instagram: colaboradores (até três), marcações de pessoas, localização
por ID da Meta, texto alternativo da primeira imagem, nome do áudio original,
compartilhamento do Reel no Feed e identificação de IA. Convites de colaboradores
dependem de aceite manual na rede social. Marcações de fotos ficam no centro da
primeira imagem do post/carrossel.

Primeiro comentário e desativação de comentários usam
`instagram_business_manage_comments`. Executam após confirmação da publicação;
falhas viram avisos separados e não tentam reenviar o post ou o comentário.
Operação interrompida precisa de conferência manual para evitar duplicatas.

Parceria paga, Instagram Shop, músicas da biblioteca e Reels de teste não estão
disponíveis. Dependem de funcionalidades, elegibilidade e configurações adicionais
da Meta; a interface informa essas limitações.

## Calendário e relatórios

Calendário consulta até 2.000 eventos por mês, independentemente da paginação da
fila (50 itens). Filtros por cliente/todos, rede, canal e situação. Ao exceder a
janela, informa truncamento e pede filtros. Selecionar dia filtra a fila no servidor.

Os relatórios completos e a rotina de coleta são descritos em [social-analytics.md](social-analytics.md).
Relatórios por cliente, períodos de até 30 dias e cache de 30 minutos. Seguidores
são o total atual; alcance, visualizações e interações são totais do período
retornados pela Meta. Não soma alcance único diário. Valores ausentes são nulos e
aparecem como indisponíveis. Consulta até 1.000 mídias do histórico coletado e informa
resultado parcial. Stories expirados aparecem quando foram coletados a tempo. CSV trata valores como dados,
neutralizando fórmulas de planilha.

Instagram precisa de `instagram_business_manage_insights`; a autorização estendida
é opcional e solicitada pelo botão específico. Facebook avançado depende de
`read_insights`, ainda fora da configuração atual. Reconectar limpa o cache da
conta. Um aplicativo em teste continua limitado às contas autorizadas como
testadoras; clientes externos dependem de liberação da Meta.

## Mídias, migração e operação

Séries ativas preservam seus arquivos e capas. Fora delas, a limpeza espera 48h
após todas as referências aplicáveis terem sido publicadas. Rascunhos, falhas e
publicações incertas preservam o arquivo. Ocorrências canceladas não impedem a
limpeza de um arquivo que já tem publicação confirmada antiga. Metadados e
histórico são preservados. Arquivos sem publicação não são removidos por essa regra.

Antes do deploy, criar backup com restauração verificada. Aplicar somente a migração
aditiva `20261021160000_social_studio` pelo `scripts/prepare-social.ts`, com projeto
Supabase esperado. Ela adiciona opções e vínculo de série aos posts, tabelas de
séries e cache de relatórios, índices e RLS. Não executar `db push` em produção.
O runtime Hadar existente recebe acesso somente às duas novas tabelas privadas.
As colunas aditivas são compatíveis com o código antigo. Antes de um rollback para
a versão anterior do módulo, desligar publicação e limpeza de mídias: a versão
antiga não conhece as referências de capas e séries ativas.

As chaves de criptografia, conexões Meta, dados existentes e integração Asaas não
são substituídos. Instalações isoladas, como Insider, precisam de migração e deploy
próprios; atualizar a Hadar não as atualiza automaticamente.

## Verificação

`npm run test:social` verifica validação, OAuth, limites, opções, segurança do
publicador e política de retenção. `npm run test:social:db` exige
`TEST_DATABASE_URL` explícita para PostgreSQL local descartável, com nome
`social_test_*` ou `social_preview_*`. A base precisa do schema anterior e de um
usuário de teste. O teste aplica a migração editorial aditiva se necessário e cria
somente seus próprios clientes temporários, removendo-os ao terminar. Verifica
datas manuais, carrossel, expansão concorrente, exceções editadas e retenção de
capas/séries ativas. Chamadas de armazenamento são simuladas e não publica na Meta.
