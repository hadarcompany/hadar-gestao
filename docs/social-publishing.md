# Publicações: configuração e operação

## Estado desta implementação

O módulo tem login oficial separado para Instagram e Facebook, contas por cliente,
rascunhos, edição, aprovação administrativa, calendário em Brasília e fila persistente.
Os publicadores implementam posts JPEG, carrosséis de 2 a 10 imagens, Reels MP4 e
Stories de imagem/vídeo. No Instagram, Stories exigem conta Business. No Facebook,
as publicações vão para páginas, nunca para perfis pessoais.

A compilação e os testes locais não substituem o teste com contas reais. A
validação de OAuth e publicação na Meta depende de criar/configurar um aplicativo,
autorizar contas de teste e depois obter os acessos necessários para clientes
externos. Até concluir isso, manter `SOCIAL_PUBLISHING_ENABLED=false`.

Em 20/10/2026, foi criado o aplicativo **Hadar Gestão**, ID **1070575842472604**,
com o contato `contato@agenciahadar.com.br`, os casos de uso de Instagram e
Páginas e o portfólio **Agencia Hadar**. O responsável autorizou a criação e os
termos e concluiu a verificação da sessão do portfólio. O aplicativo está
**não publicado**. O aplicativo existente **CRM Hadar Company** foi preservado.

O produto Instagram tem ID próprio **1414989730830067**. O domínio
`agenciahadar.com.br` e os quatro callbacks de OAuth listados neste guia foram
salvos no painel. As cinco permissões usadas pelo módulo estão prontas para
teste. O fluxo **Publicações Hadar Gestão** usa token de usuário e configuração
**1471564921703768**, com `pages_show_list`, `pages_read_engagement` e
`pages_manage_posts`. Com `config_id`, o código não envia `scope` adicional.

Os dois IDs, secrets e o config ID estão nos arquivos privados
`Documentos/Hadar/Credenciais/Hadar/Publicacoes - Configuracao.env` e
`Documentos/Hadar/Credenciais/Insider Midia/Publicacoes - Configuracao.env`.
Eles ainda não foram aplicados à hospedagem. Não regenerar as chaves de
criptografia ao instalar a configuração. Revisão para clientes externos e
teste real de conexão/publicação ainda precisam ser concluídos.

A conta **@hadarcompany** aceitou o convite de **Testador do Instagram** em
20/10/2026. O aceite foi informado pelo responsável e confirmado após atualizar
o painel da Meta: a indicação **Pendente** não aparece mais nessa conta.

O código e os testes estão locais. O módulo, as novas tabelas, o bucket de
mídia e o agendador ainda não foram instalados nas instâncias de produção.

## Criar o aplicativo Meta

1. Entrar em <https://developers.facebook.com/apps/> com o perfil pessoal que
   administrará o aplicativo. Concluir a confirmação de desenvolvedor se solicitada.
2. Criar o aplicativo com o nome **Hadar Gestão** e um e-mail comercial válido.
   Vincular ao portfólio empresarial correto da Hadar. Conferir os dados da
   empresa e as exigências de verificação no próprio painel.
3. Selecionar os casos de uso de gestão de conteúdo do Instagram e de páginas
   do Facebook disponíveis no painel. Os nomes e a organização das telas podem
   variar; não selecionar somente anúncios, pois Marketing API não publica posts
   orgânicos. Se o painel não permitir ambos, usar dois aplicativos e preencher
   as credenciais separadas descritas abaixo.
4. Para Instagram, configurar **Instagram API com Instagram Login**. Copiar o
   **Instagram App ID e Instagram App Secret** desse produto. Eles podem ser
   diferentes do ID/secret geral do aplicativo Facebook.
5. Autorizar as permissões `instagram_business_basic` e
   `instagram_business_content_publish`. Não solicitar mensagens, comentários ou
   anúncios para este módulo.
6. Configurar o login de Facebook/Páginas com `pages_show_list`,
   `pages_read_engagement` e `pages_manage_posts`. Se usar uma configuração de
   Facebook Login for Business, guardar também o `config_id` correspondente.
7. Cadastrar as URIs de retorno exatas, sem barra extra, e o domínio do aplicativo.
   Para Hadar:

   ```text
   https://gestao.agenciahadar.com.br/api/social/callback/instagram
   https://gestao.agenciahadar.com.br/api/social/callback/facebook
   ```

   Para Insider:

   ```text
   https://insidermidia.agenciahadar.com.br/api/social/callback/instagram
   https://insidermidia.agenciahadar.com.br/api/social/callback/facebook
   ```

   Cada instância valida seu próprio state, usuário e cliente. Não usar callback
   de uma empresa para autorizar outra. `APP_URL` deve conter a origem HTTPS exata.

8. Em desenvolvimento, configurar as contas e pessoas de teste pelo painel e
   aceitar os convites. Conferir os requisitos específicos do produto Instagram.
9. Para disponibilizar a clientes externos, preencher os dados básicos do app,
   domínio/site, política de privacidade e instruções públicas de exclusão de
   dados. Preparar as demonstrações das permissões, verificação empresarial e
   revisão/acesso exigidos pelo painel. Não prometer prazo de aprovação.

## Preparação técnica por instância

As variáveis privadas são independentes de Meta Ads, Asaas e WhatsApp:

```env
SOCIAL_INSTAGRAM_APP_ID=
SOCIAL_INSTAGRAM_APP_SECRET=
SOCIAL_FACEBOOK_APP_ID=
SOCIAL_FACEBOOK_APP_SECRET=
SOCIAL_FACEBOOK_CONFIG_ID=
SOCIAL_TOKEN_ENCRYPTION_KEY=
SOCIAL_WORKER_SECRET=
SOCIAL_STORAGE_LIMIT_MB=512
SOCIAL_PUBLISHING_ENABLED=false
```

Gerar as duas chaves com pelo menos 32 caracteres aleatórios e guardá-las na
pasta privada de credenciais. A chave de criptografia deve permanecer estável
entre releases e ser preservada nos backups. Nunca colocar secrets no Git,
NEXT_PUBLIC, screenshots, descrições de PR ou logs.

Fazer backup antes da alteração do schema. Com `DIRECT_URL` administrativo,
Supabase URL e service key da instância correta carregados no ambiente:

```sh
npm run social:prepare -- --project-ref=REF_EXATO
npm run social:prepare -- --project-ref=REF_EXATO --apply
```

A preparação executa apenas a migração aditiva das cinco tabelas novas, em
transação, com RLS, e cria o bucket privado `social-media`. Não executar `db push`,
seed, initialize-instance ou migrate deploy no banco existente para instalar o
módulo. O histórico legado contém alterações manuais. O usuário limitado da Hadar
recebe políticas somente nas tabelas novas; dados existentes não são alterados.

O envio é direto ao Supabase com autorização temporária para um único caminho,
sem sobrescrita. Reservamos o tamanho máximo permitido até conferir o arquivo
real. O limite do módulo é uma proteção adicional, não uma contratação de quota
do Supabase. Conservar margem no plano existente. Arquivos cancelados/removidos
do editor continuam no armazenamento; não existe exclusão automática de mídia
arquivada nesta primeira versão. Conferir a utilização antes de aumentar a quota.

## Agendador na VPS

1. Instalar `deploy/social/worker.py` em
   `/opt/hadar-gestao/operations/social/worker.py`.
2. Criar `config/hadar.json` e `config/insidermidia.json` na mesma pasta:

   ```json
   {
     "url": "https://DOMINIO/api/social/worker",
     "secretFile": "/CAMINHO/PRIVADO/worker.key"
   }
   ```

3. Guardar a chave do worker por instância em arquivo 600, diretórios 700.
4. Instalar `hadar-social@.service` e `hadar-social@.timer` em `/etc/systemd/system`,
   executar `systemctl daemon-reload` e habilitar a instância correta:

   ```sh
   systemctl enable --now hadar-social@hadar.timer
   systemctl start hadar-social@hadar.service
   ```

5. O timer roda um passo por minuto, com lock por instância. Esse passo pode
   preparar a mídia, esperar a Meta processá-la ou concluir a publicação. A
   publicação não é um relógio de precisão: processamento e limites da Meta podem
   atrasar a postagem. Medir a fila antes de escalar o número de clientes.
6. A tela só libera agendamento quando o envio estiver ativado e o worker tiver
   se comunicado nos últimos dez minutos. Examinar também `systemctl --failed`.
   Não há alerta externo de falha implementado.

O endpoint exige bearer secret próprio, mesmo sem sessão de navegador. O worker
respeita o vencimento do período de teste. Não publicar ao atualizar/reiniciar o
servidor sem uma aprovação registrada na fila.

## Primeiro teste real

1. Usar uma conta profissional própria autorizada como teste pela Meta.
2. Abrir Publicações, selecionar o cliente correto e clicar **Conectar Instagram**
   ou **Conectar Facebook**. No Facebook, selecionar somente as páginas desse cliente.
3. Conferir a conta exibida, preparar um conteúdo identificável de teste e enviar
   para aprovação. Confirmar arquivo, destino e horário antes de aprovar.
4. Ativar `SOCIAL_PUBLISHING_ENABLED=true` somente quando credenciais, worker e
   permissões estiverem prontos. Recriar apenas o app na VPS ou fazer novo deploy
   da configuração na Vercel. O primeiro conteúdo será publicado de verdade.
5. Aprovar e agendar; conferir o resultado na própria rede social. Repetir para
   cada formato/rede pretendidos, incluindo processamento de vídeo, erro de
   autorização e reconexão. Esses testes reais aguardam a liberação da Meta.

Se houver timeout depois que a solicitação de publicação foi enviada, o estado
fica **Conferir na rede social**, sem repetição automática. Um operador deve
conferir o destino antes de criar outro post. Uma falha anterior ao envio pode
ser editada e novamente aprovada. Toda edição remove a aprovação anterior e devolve o conteúdo a rascunho ou
aguardando aprovação, conforme a ação escolhida.

A renovação de token Instagram é tentada nos jobs quando necessário e permitido.
Revogações, mudanças de senha/permissões ou vencimento podem exigir novo login.
Desconectar remove os tokens locais e cancela os agendamentos ainda não enviados;
as publicações existentes permanecem na rede social.

## Backup e recuperação de mídia

Ao publicar o módulo, atualizar o backup para a versão de `deploy/backup/backup.py`
que suporta Storage. Adicionar `"storageBuckets":["social-media"]` à configuração
privada de cada instância depois de criar o bucket. O backup falha se não conseguir
listar/baixar os objetos ou conferir seus tamanhos. Testar uma execução completa
antes de liberar upload aos usuários. Não marcar a mídia como protegida por backup
sem instalar e validar essa configuração no servidor.

Atualizar também o espelho privado `environmentFile` do backup com as variáveis
`SOCIAL_*` efetivamente publicadas, incluindo a chave de criptografia. O arquivo
antigo da Hadar não contém essas variáveis. Não sobrescrever outras integrações
ao mesclar a configuração.

O TAR criptografado passa a incluir `storage/social-media/...` e hashes por objeto
no manifesto. Na recuperação, criar bucket **privado**, repor os objetos nos mesmos
caminhos, conferir os hashes e restaurar o banco. O teste automático de restauração
SQL não substitui o teste de upload/abertura da mídia no Supabase de destino.

## Referências oficiais

- [Instagram Login e permissões](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login)
- [Instagram: publicação de Reels](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
- [Facebook: publicação de Reels](https://www.postman.com/meta/facebook/documentation/r56bjfd/facebook-api)
- [SDK Meta: photo_stories e video_stories](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/page.py)
