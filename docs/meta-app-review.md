# Preparação da análise do app Meta

Aplicativo: **Hadar Gestão**, ID **1070575842472604**. Produto Instagram:
**1414989730830067**. Portfólio: **618948627968712**.

Em 22/10/2026 o painel confirmou a empresa **HADAR MARKETING COMPANY LTDA** como
**Verificada**, originalmente em 21/10/2026. Isso não aprova automaticamente o app.
O pedido **1071288309068024** permanece em preparação; não registrar como enviado
até o painel confirmar o envio.

## Páginas públicas

- Política: `https://gestao.agenciahadar.com.br/privacidade`
- Instruções de exclusão: `https://gestao.agenciahadar.com.br/exclusao-de-dados`
- Site do aplicativo: `https://gestao.agenciahadar.com.br/login`
- Contato: `contato@agenciahadar.com.br`

Essas páginas precisam estar disponíveis em produção sem login, inclusive depois
do período de teste. A liberação deve se limitar a GET/HEAD desses dois caminhos
exatos. Não adicionar exceções para APIs nem diretórios inteiros.

A exclusão completa é solicitada por e-mail e depende de confirmação da autoridade
sobre os dados. Desconectar apaga o token salvo e cancela/pausa a fila dessa conta,
preservando o histórico. Não declarar que a desconexão apaga todos os dados ou que
remove postagens já publicadas. Não informar uma URL de callback de exclusão se
somente as instruções manuais estiverem implementadas.

## Escopo da primeira análise

Para conectar e publicar:

| Permissão | Justificativa e evidência |
| --- | --- |
| instagram_business_basic | OAuth oficial; identificação do perfil profissional conectado por ID e nome de usuário. |
| instagram_business_content_publish | Conteúdo escolhido pelo usuário, envio imediato/agendado e confirmação na conta de teste. |
| pages_show_list | Listar páginas administradas e selecionar o destino do cliente. |
| pages_read_engagement | Ler informações da página e conteúdo publicado para identificar e confirmar o destino/publicação. |
| pages_manage_posts | Criar o conteúdo solicitado na página selecionada e confirmar o resultado. |
| public_profile | Permissão padrão do fluxo Facebook; explicar o vínculo com a autorização, sem alegar login social no Gestão. |

O pedido inicial do painel também inclui `business_management`,
`instagram_business_manage_insights` e `instagram_business_manage_comments`.
`business_management` não é necessário para o módulo de publicações.
Relatórios/comentários podem ser analisados em uma etapa posterior. Se forem
retirados, retirar **somente do pedido de análise**, sem revogar autorizações
existentes ou remover funções do app. A conexão básica já solicita somente perfil
e publicação; as permissões adicionais dependem da opção `extended`.

## Acesso do analista

Usar ambiente com banco separado e dados fictícios. A conexão de contas exige
administrador; conceder administrador da produção permitiria acesso aos dados
reais da agência. Não fornecer a conta de Alexandre nem senha do Instagram ou do
Facebook. Guardar a credencial exclusiva da análise na pasta privada de credenciais,
fora deste repositório. Somente cadastrar no formulário da Meta após confirmar o
isolamento, o login e os callbacks HTTPS desse ambiente.

## Gravação e teste real

O screencast deve mostrar o produto real, não um protótipo ou imagens que simulem
uma publicação concluída. Ocultar senhas, tokens, chaves e dados de outros clientes.

1. Abrir o ambiente de teste, entrar com a conta exclusiva e selecionar o cliente
   fictício destinado ao teste.
2. Clicar em Conectar Instagram, mostrar o OAuth oficial e a conta profissional
   autorizada; voltar e mostrar o nome do perfil conectado.
3. Criar uma publicação identificada como teste, selecionar a mídia, conferir a
   prévia e usar o envio imediato; aguardar o estado confirmado pela Meta.
4. Mostrar o conteúdo na própria rede social. Não marcar o teste como realizado
   apenas porque um container de mídia foi criado ou o post entrou na fila.
5. Repetir conexão, seleção de página e publicação no Facebook.
6. Mostrar o calendário e a opção de desconectar, sem desconectar uma conta que
   tenha postagens reais pendentes.

Contas indicadas pelo responsável: Instagram **@hadarcompany** e página
**Agencia Hadar**, `https://www.facebook.com/people/Agencia-Hadar/61575290071951/`.
Não usar páginas de clientes para esse teste. Não apagar conteúdo de teste da rede
social sem autorização específica para a exclusão.

## Tratamento de dados

O responsável informou em 22/10/2026:

- Não forneceu dados pessoais recebidos da Meta a autoridades em resposta a
  solicitações de segurança nacional nos últimos 12 meses.
- Não há procedimentos definidos dentre as opções do formulário para pedidos de
  autoridades. Selecionar **Nenhuma das opções acima**; não marcar políticas
  inexistentes para completar a análise.

Responsável pelos Dados da Plataforma: **HADAR MARKETING COMPANY LTDA**, Brasil.
Declarar os provedores efetivamente utilizados (banco/autenticação, hospedagem e
mídia). Conferir países de processamento e acesso remoto nos documentos dos
provedores e nas configurações reais; não inferir todos os países apenas pela sede.

## Antes do envio

Conferir configurações básicas, ícone, URLs públicas, justificativas, chamadas de
teste exigidas, vídeos reais, credencial isolada e respostas de tratamento de dados.
Revisar as declarações de conformidade no momento de aceitá-las. O painel informa
que não será possível editar/cancelar o pedido durante a análise. Guardar a
confirmação de envio; não prometer prazo de aprovação.

Migração da Hadar para a VPS é uma etapa separada. Não alterar chaves ou callbacks
de Asaas e WAHA para preparar o pedido Meta.
