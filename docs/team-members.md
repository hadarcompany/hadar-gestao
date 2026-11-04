# Cadastro da equipe

Em **Configurações → Equipe → Novo usuário**, o administrador informa nome, e-mail, senha inicial e permissões por área. O acesso também pode ser aberto por `/configuracoes?tab=equipe`.

A conta é criada como **membro**, com acesso apenas às áreas escolhidas. Tarefas e Meu Trabalho começam com edição; as demais áreas começam sem acesso. O administrador pode alterar cada área para “Sem acesso”, “Apenas visualizar” ou “Visualizar e editar”, tanto no cadastro quanto depois, usando “Salvar permissões”. Administradores existentes continuam com acesso total e não têm suas permissões alteradas por esse formulário.

Compartilhe o endereço da instalação, o e-mail e a senha inicial com a pessoa cadastrada. O cadastro não envia convite nem confirmação por e-mail. A pessoa pode trocar a senha em Configurações → Meu Perfil. Use senhas de pelo menos 12 caracteres.

O servidor valida a sessão, a origem da requisição, o cargo de administrador e a lista de permissões. Novas contas são registradas no Supabase Auth e em `users` da própria instalação; a senha é cifrada no registro legado e nunca é devolvida pela API. Uma conta existente não tem sua senha ou permissões substituídas ao repetir o cadastro. O registro em Auth só é removido como compensação quando foi criado pela mesma operação e o banco confirmou que o novo registro não existe. Uma confirmação perdida do banco é conferida antes de qualquer compensação.

Não há migração de schema neste recurso. Para atualizar instalações antigas, aplique os arquivos deste recurso à versão que já atende a empresa; não troque seu schema nem execute migrações de módulos que ela ainda não utiliza. Preserve o `.env`, o período de teste, as integrações, a imagem anterior e a rede do proxy. Compile e confira a autenticação administrativa, a recusa de cadastros por membros e o tratamento de e-mail duplicado antes de liberar o botão.

Verificações: `npm run test:team`, `npm run test:security`, TypeScript e build. A suíte utiliza Auth/DB simulados; o teste adicional de banco deve usar somente um PostgreSQL descartável. Testes de interface não devem criar contas reais em produção.

## Exportações do Monday

A migração será preparada quando o arquivo original for recebido, com inventário de abas/colunas, mapeamento de clientes, responsáveis, tarefas, status, datas e outros campos existentes. A prévia deve mostrar totais e exceções antes da gravação. A importação precisa preservar um identificador de origem para não duplicar itens ao repetir o processo. Arquivos anexados, comentários, histórico e campos que não estejam presentes na planilha devem ser verificados à parte; não se deve presumir que todo o conteúdo do Monday foi exportado.
