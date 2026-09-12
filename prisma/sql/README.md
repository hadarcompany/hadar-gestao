# Logos dos clientes e anexos de tarefas

As logos reutilizam clients.logoUrl, já presente na migração inicial. Nenhuma tabela nova para fotos.

Os anexos precisam da tabela task_attachments. Execute task-attachments.sql no SQL Editor do banco do projeto, se a tabela ainda não existir. O script não altera as outras funcionalidades em andamento e não apaga registros. Não foi executado automaticamente no banco remoto.

Depois execute npx prisma generate e publique a aplicação. A tabela é compatível com TaskAttachment no schema.prisma. Arquivos de até 8 MB são armazenados como base64 na coluna data; não precisa criar bucket. O base64 ocupa aproximadamente 33% mais espaço. Apenas metadados são enviados nas listagens, e downloads passam por autenticação. Remoção permitida ao autor do envio e administradores; excluir a tarefa remove seus anexos.

Uso: abra uma tarefa, vá até Anexos e clique em Anexar arquivo. O envio é salvo automaticamente. Os arquivos podem ser baixados e removidos nessa seção.

Há outras alterações anteriores no schema (demanda semanal, chat, notificações e transferências) que não fazem parte deste SQL. Não execute db:push indiscriminadamente para aplicar somente os anexos.

As logos aparecem nas listas e detalhes de tarefas, agrupamento por cliente, tarefas concluídas, dashboard, calendário, serviços, acessos, financeiro e NPS. Clientes sem logo ou com imagem indisponível usam a inicial do nome.
