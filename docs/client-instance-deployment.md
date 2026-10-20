# Instâncias na VPS

Cada cliente usa app, rede Docker, chaves e projeto Supabase próprios. Não copie
o `.env` da Hadar. A instância atual da Hadar permanece na Vercel.

## Primeira instalação

1. Criar um projeto Supabase vazio. Configurar URL do site e redirects para
   `https://insidermidia.agenciahadar.com.br`; desativar cadastro público.
2. Criar no DNS um registro A `insidermidia` para `129.121.45.211`. Conferir
   se existe AAAA conflitante antes de solicitar o certificado.
3. Preparar uma release sem `.git`, `.env` ou histórico do repositório.
4. Copiar `deploy/instance.env.example` para o caminho indicado pelo
   `INSTANCE_ENV_FILE`, fora da release, e preencher as credenciais do cliente.
   Restringir a pasta a 700 e o arquivo a 600. A chave de criptografia deve
   ser exclusiva e permanecer estável entre atualizações.
5. Usar o prefixo abaixo para os comandos (a partir da pasta da release):

   ```sh
   docker compose --env-file /opt/hadar-gestao/instances/insidermidia/.env -f deploy/instance.compose.yml
   ```

6. Executar com esse prefixo `build admin`, depois
   `run --rm admin node node_modules/tsx/dist/cli.mjs scripts/initialize-instance.ts PROJECT_REF`.
   O inicializador confere o ref das conexões, banco e Auth vazios, cria o
   schema atual, ativa RLS e cria o administrador. Ele recusa bancos com tabelas.
   A operação abrange dois serviços e não é atômica: em caso de falha, interromper,
   inspecionar a etapa e reparar explicitamente. Nunca apagar tabelas para tentar de novo.
7. Remover os três `BOOTSTRAP_ADMIN_*` do arquivo após guardar o acesso inicial.
8. Executar com o mesmo prefixo `build app` e `up -d --wait app`.
9. Conectar o Caddy à rede: `docker network connect gestao-insidermidia_web hadar-caddy`.
   Acrescentar `deploy/insidermidia.Caddyfile` ao Caddyfile existente com backup,
   validar com `caddy validate` e fazer `caddy reload`, sem reiniciar o WAHA.
   Registrar essa rede como externa na definição do serviço Caddy para preservar
   a conexão quando o proxy for recriado.
10. Testar login, criação de usuário, isolamento, tarefas e anexos no domínio.
    O Asaas do cliente só é configurado com a chave dele em Integrações.

O build recebe apenas as duas variáveis públicas do Supabase. Credenciais privadas
entram no container durante a execução. O `.dockerignore` exclui os arquivos de
ambiente e o histórico. Por usar NEXT_PUBLIC_, cada projeto Supabase exige seu build.
Configure `APP_URL` com a origem HTTPS exata da instância. O middleware, a proteção
de origem e os links de webhook usam esse valor atrás do proxy; headers enviados
pelo cliente não podem definir uma origem confiável.

## Atualizações

Mudar `RELEASE_TAG` e preparar nova release; não usar initialize-instance nem seed.
Conferir e fazer backup antes de aplicar alterações de schema. O histórico atual
de migrações não representa todas as alterações manuais antigas: não executar
`migrate deploy` ou `db push` em bancos existentes sem revisar a diferença.
Manter a imagem anterior para rollback. Não executar `down -v` nem podar imagens
ou volumes indiscriminadamente. Monitorar memória à medida que novos clientes entram.

## Estado da Insider em 20/10/2026

- Domínio: `https://insidermidia.agenciahadar.com.br` na VPS `129.121.45.211`.
- Supabase exclusivo: `Insider-gestao`, ref `nmpglrzusdvbuhwrqkmm`, região us-east-1.
- Release: `/opt/hadar-gestao/releases/20261020-insidermidia-02`.
- Configuração privada: `/opt/hadar-gestao/instances/insidermidia/.env` (600).
- App na rede `gestao-insidermidia_web`, sem porta 3000 publicada no host.
- Caddy conectado à rede do app e configurado para preservar a conexão quando recriado.
  Configurações anteriores em `instances/insidermidia/proxy-backup`.
- 41 tabelas públicas com RLS; um administrador (Gabriel), nenhum cliente ou tarefa.
- Chaves Asaas/WAHA/Claude da Hadar não foram copiadas. Cadastro público desativado.
- Credenciais locais em `Documentos/Hadar/Credenciais/Insider Midia`, restritas ao
  usuário do Windows e SYSTEM. Nunca adicionar essa pasta ao Git ou ao contexto Docker.
- Verificação HTTP: HTTPS, domínio dos redirects, login do administrador, dashboard,
  clientes/tarefas vazios, Acessos desativado, validação de origem e Asaas sem chave.
- Login agora recarrega o contexto de autenticação após receber cookies do servidor.
  A origem pública da VPS é definida por `APP_URL`, sem confiar em headers arbitrários.

## Operação

Backups criptografados e suspensão de teste estão implementados. Consulte
[backups e período de teste](backup-and-trial.md). O responsável aprovou 14 dias
para a Insider: acesso até 03/11/2026 às 23h59, em Brasília. O bloqueio começa em
`2026-11-04T00:00:00-03:00`, sem excluir os dados.
O cadastro automático de empresas e DNS ainda não está implementado.

Na Hadar, as chaves legadas do Supabase e a antiga assinatura HS256 foram
revogadas. A aplicação usa uma chave administrativa nova, uma conexão de banco
com usuário próprio e uma chave de criptografia estável. Asaas foi validado no
domínio de produção após a revogação, incluindo conexão e webhook configurado.
A senha do usuário administrativo `postgres` ainda depende da troca no painel
pelo responsável e da atualização das ferramentas e backups logo em seguida.
