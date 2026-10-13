# Asaas por instalação

Em Configurações > Integrações > Asaas, um administrador pode cadastrar a chave da
empresa, selecionar Produção ou Testes (Sandbox), testar a conexão e salvar.
O teste consulta somente um endpoint de leitura; não cria clientes ou cobranças.
Os endpoints existentes de cobranças e sincronização continuam funcionando.

As credenciais são criptografadas e nunca voltam nas respostas do formulário.
Campos vazios preservam valores salvos. Ao trocar de ambiente, cadastre a chave
correspondente. Desconectar desativa inclusive as credenciais legadas do servidor.
Cada instalação e banco têm sua própria configuração; não há isolamento multiempresa
em um único banco nesta versão.

Para notificações de pagamentos, cadastre o endereço exibido no formulário no Asaas
e informe o mesmo token de autenticação nos dois lados. O token é diferente da chave
API. O formulário não cria um webhook automaticamente na conta Asaas.

Na primeira publicação, aplique a migração
`prisma/migrations/20261013130000_add_asaas_integration_settings/migration.sql`
antes de iniciar a aplicação, e execute `npx prisma generate` no build.
Não use `prisma db push` no banco existente para aplicar apenas esta tabela.

As variáveis ASAAS_API_KEY, ASAAS_ENVIRONMENT e ASAAS_WEBHOOK_TOKEN continuam sendo
aceitas como configuração legada da própria instalação. Não copie esses segredos
da Hadar para outra empresa. Use INTEGRATIONS_ENCRYPTION_KEY estável no servidor;
trocar essa chave exige recadastrar ou recifrar as integrações.
