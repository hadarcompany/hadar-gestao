# Backups e período de teste

## Rotina instalada em 20/10/2026

Hadar e Insider têm backups separados, com chaves AES-256-GCM próprias.
Na VPS, `hadar-backup@hadar.timer` e `hadar-backup@insidermidia.timer` executam
diariamente às 03h de Brasília, com até cinco minutos de variação. Um lock
serializa as execuções para limitar o consumo de memória. A retenção é de 14 dias.
Os arquivos ficam em `/srv/hadar-backups/<instancia>`.

Cada execução exporta os schemas `public` e `auth`, restaura o dump em um
PostgreSQL descartável sem rede, verifica usuários e RLS e testa a autenticação
da criptografia antes de publicar o arquivo. Uma falha retorna erro ao systemd
e grava `status.json` com estado `failed`. Não há envio automático de alertas;
acompanhar `systemctl --failed` e o status dos backups.

O pacote contém o banco, um manifesto e o arquivo de ambiente configurado.
Arquivos binários de buckets do Supabase Storage não estão incluídos. Anexos
armazenados nas tabelas estão incluídos. Na Hadar, o ambiente salvo contém as
conexões Supabase e a chave de criptografia; variáveis exclusivas da Vercel,
incluindo Asaas, continuam na Vercel e precisam ser preservadas na recuperação.

No Windows, a tarefa `Hadar_BackupSync` roda às 04h de Brasília e baixa cópias para
`Documentos/Hadar/Backups`. Ela confere SHA-256, detecta backup vencido há mais
de 30 horas e mantém até 30 dias, preservando o arquivo mais recente. Precisa
do computador ligado e do usuário conectado; se perder o horário, executa
quando houver disponibilidade. Os backups da VPS continuam independentes disso.
O resultado local fica em `Documentos/Hadar/Operacao/backup-pull-status.json`.

O usuário SSH `hadarbackup` só permite SFTP de leitura, sem shell, escrita ou
encaminhamento de portas. As pastas locais de credenciais, operação e backups
estão restritas ao usuário do Windows e SYSTEM. Guarde outra cópia protegida das
chaves: perder a chave impede a recuperação dos arquivos criptografados.

## Recuperação

1. Conferir SHA-256 do `.hgb` com seu manifesto `.json`.
2. Usar `deploy/backup/decrypt-backup.mjs` e a chave da instância:

   ```sh
   node decrypt-backup.mjs arquivo.hgb chave.txt destino-novo.tar
   ```

3. Extrair o TAR somente em pasta privada. Ele contém credenciais e dados pessoais.
4. Restaurar primeiro em banco de teste vazio, usando PostgreSQL 18 e as roles
   referenciadas pelas políticas. Em Supabase, preservar as roles e extensões
   próprias do provedor; não executar scripts de limpeza em produção.
5. Conferir tabelas, usuários, tarefas, RLS e login. Recuperar separadamente
   arquivos externos do Storage e configurações específicas da hospedagem.
6. Só trocar a conexão do aplicativo após validar a restauração. As chaves da
   instância de destino devem corresponder ao projeto e à chave que cifra as
   integrações. Não copiar credenciais de outra empresa.

Os testes instalados verificam a restauração local do SQL; não simulam uma
migração completa entre projetos Supabase, domínios e integrações externas.

## Configuração do servidor

Scripts e configurações privados ficam em `/opt/hadar-gestao/operations`, com
acesso de root. Os exemplos públicos do repositório ficam em `deploy/backup`.
Cada `config/<instancia>.json` informa `instance`, `databaseUrl`, `environmentFile`,
`keyFile`, `output`, `staging`, `retentionDays` e, se necessário, `restoreRoles`.
O dump exige uma conexão administrativa por pooler de sessão, porta 5432,
com SSL; a conexão limitada do aplicativo não tem acesso ao schema `auth`.

Após mudar a senha administrativa do banco, atualizar `databaseUrl` do backup,
`DIRECT_URL` nas ferramentas e o espelho privado de ambiente. Rodar imediatamente
`systemctl start hadar-backup@hadar.service` e conferir `Result=success` e o novo
manifesto. Não alterar a chave Asaas nem `INTEGRATIONS_ENCRYPTION_KEY` nesse passo.

## Período de teste

`INSTANCE_TRIAL_ENDS_AT` é uma variável privada de execução por instância.
Vazia significa acesso sem prazo. Para ativar, definir data ISO com fuso, por
exemplo `2026-11-03T23:59:59-03:00`, somente depois de aprovar o prazo comercial.
Não há uma data padrão embutida. Data inválida bloqueia o acesso por segurança.

Salvar no `.env` privado e recriar apenas o app:

```sh
docker compose --env-file /opt/hadar-gestao/instances/insidermidia/.env \
  -f /opt/hadar-gestao/current/insidermidia/deploy/instance.compose.yml \
  up -d --wait app
```

O bloqueio é conferido em cada requisição, inclusive em sessões abertas. Páginas
e APIs retornam 402, sem apagar dados. Logout e entrada de webhooks continuam
disponíveis. O healthcheck aceita 402 como servidor funcional. Para prorrogar,
alterar a data; para liberar definitivamente, esvaziar a variável e recriar o app.
Essas operações ficam com o operador da hospedagem, fora do alcance do cliente.

A release 02 foi testada com prazo vencido em container isolado sem rede e com
login normal na instância publicada. A Hadar na Vercel permanece sem prazo.
