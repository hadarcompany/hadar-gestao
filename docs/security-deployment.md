# Segurança da implantação

Antes de publicar esta versão, rode `npm run security:apply` no ambiente de destino.
O comando importa somente contas ausentes no Supabase Auth, mantendo hashes bcrypt;
nunca redefine senhas de contas já existentes. Depois ativa RLS nas tabelas públicas.
`npm run security:check` verifica as contas sem fazer alterações.

A autenticação usa somente o Supabase Auth. Mudanças e recuperação de senha não
podem usar a senha legada de `public.users` para redefinir uma conta existente.
Mantenha cadastro público desativado quando usuários são convidados pelo administrador.

O .env foi retirado do índice do Git, preservando o arquivo local. Os commits antigos
ainda contêm segredos: remover o arquivo agora não revoga essas credenciais.
Rotacione senha do banco e a chave administrativa do Supabase, atualize os segredos
da hospedagem e republique. A limpeza do histórico exige coordenar os clones e branches.
Não publique o repositório antes dessa limpeza e rotação.

Antes de trocar a chave administrativa, preserve as integrações criptografadas.
O assistente pode derivar sua chave de SUPABASE_SERVICE_ROLE_KEY: estabeleça uma chave
INTEGRATIONS_ENCRYPTION_KEY estável e recifre os registros ou reconecte a integração.
Não altere as credenciais sem atualizar o ambiente que atende os usuários.

A área Acessos foi removida das telas e suas APIs devolvem HTTP 410. Dados antigos
permanecem no banco e não são enviados nos detalhes de clientes. Nenhuma exclusão
de credenciais armazenadas foi executada.

O limite adicional de login é por conta e por processo, adequado à instância inicial.
Ao executar várias instâncias, use um armazenamento compartilhado para esse limite.
Configure HTTPS, backups externos, firewall e acesso administrativo na VPS.

Cada empresa precisa de uma instalação e banco isolados. Esta revisão não implementa
multiempresa em um banco compartilhado. Nunca conecte empresas diferentes ao mesmo
banco antes de implementar e testar esse isolamento.

Validação em 13/10/2026: as 41 tabelas públicas do banco configurado estão com RLS;
a consulta executada como `anon` não lê mensagens do WhatsApp. As 4 contas existentes
já estavam no Supabase Auth. Os testes de segurança usam banco/autenticação simulados.

Next.js foi atualizado para 15.5.27; next-auth e bcrypt nativo, sem uso na aplicação,
foram removidos. PostCSS e dependências transitivas foram atualizados. Tailwind e seu
plugin de animações são ferramentas de compilação, declaradas em devDependencies.
`npm audit --omit=dev` não aponta vulnerabilidades. A auditoria completa ainda aponta
9 pacotes da cadeia Tailwind/ESLint (braces e parser de seletores); não forneça arquivos
ou padrões não confiáveis ao build. A resolução restante requer uma migração avaliada
das ferramentas, sem forçar alterações de CSS no aplicativo durante esta correção.
