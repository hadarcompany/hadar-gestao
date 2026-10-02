# Assistente Hadar com Claude e comandos de voz

O botão **Assistente** fica disponível nas páginas autenticadas. É possível digitar ou falar comandos em português e acompanhar cada ação executada.

Também é possível navegar: “Abra o financeiro” ou “Vá para minhas tarefas”, respeitando a permissão da página.

## Uso

- “Crie uma tarefa de editar reels para o cliente X, com prazo amanhã, e atribua ao Alexandre.”
- “Liste as tarefas atrasadas do cliente X.”
- “Transfira a tarefa X para o Felipe.”
- “Cadastre uma despesa avulsa de R$ 150, alimentação, hoje, paga por Pix.”
- “Cadastre o cartão Nubank Empresa e registre esta despesa nele.”
- “Crie um lead para a empresa X.”

Criações e alterações são executadas automaticamente por padrão, conforme a preferência solicitada. Em **Execução automática ativada**, desmarque a opção se quiser revisar os dados antes de executar. Exclusões sempre ficam pendentes de confirmação.

O assistente consulta tarefas, clientes, projetos, equipe, áreas, etiquetas, leads, metas, serviços, despesas, cartões, recebimentos manuais, resumo financeiro e calendário. Pode criar, editar e excluir registros dos módulos com ferramentas de alteração; transferências de tarefas reutilizam o fluxo de histórico e notificações do sistema. Não executa código, pagamentos, emissão de cobranças Asaas ou envio de mensagens externas, nem lê cadastros de senhas. Quando um recurso não tem ferramenta, ele informa a limitação.

Consultas e ações respeitam as permissões do usuário autenticado. A criação de valores em leads e serviços exige também edição do financeiro. Transferências usam pessoas identificadas por consulta, e nomes ambíguos exigem esclarecimento. O assistente recebe a data atual no fuso America/Sao_Paulo.

## Voz

A transcrição usa `SpeechRecognition`/`webkitSpeechRecognition` do navegador em `pt-BR`, sem adicionar outra chave de transcrição. Ative o microfone pelo botão **Falar** e conceda a permissão. Por padrão, o comando é enviado quando a fala termina; desative **Enviar o comando ao terminar de falar** para revisar o texto.

O reconhecimento depende do navegador, do microfone e de uma conexão segura (HTTPS ou localhost). Navegadores compatíveis podem usar serviços externos para reconhecer áudio. Quando o navegador não oferece a API, o painel informa que a voz está indisponível e mantém os comandos por texto. O áudio não é salvo pelo aplicativo.

## Configuração e publicação

1. Revogue a chave compartilhada na conversa e crie uma nova no console da Anthropic. Ela não foi incluída no código nem usada em testes.
2. No ambiente do servidor/publicação, configure `ANTHROPIC_API_KEY` e, opcionalmente, `ANTHROPIC_MODEL`. O padrão é `claude-sonnet-4-6`. Nunca use prefixo `NEXT_PUBLIC_` para a chave. Para desenvolvimento local, prefira `.env.local`, que é ignorado pelo Git. Não adicione a chave ao `.env` versionado deste repositório.
3. Aplique `prisma/migrations/20261002150000_add_assistant_actions/migration.sql`. Ela cria tabelas de ações e requisições com RLS ativado. A funcionalidade de cartões depende também de `20261002120000_add_credit_cards`.
4. Gere o cliente Prisma com `npx prisma generate` e publique a aplicação. O servidor precisa suportar a duração configurada de até 180 segundos para comandos de várias etapas.
5. Abra o Assistente e teste primeiro um comando de consulta, depois uma tarefa de teste. O assistente mostra um aviso de configuração quando a chave está ausente.

Use `prisma migrate deploy` somente se o histórico das migrações estiver sincronizado; em bancos mantidos por SQL manual, aplique somente os scripts necessários pelo procedimento do ambiente.

## Controle de execução

Cada comando tem um `requestId` exclusivo. Reenviar a mesma requisição retorna o resultado armazenado ou informa que ainda está sendo processada, sem repetir as alterações. Ações idênticas no mesmo comando têm uma chave de deduplicação. A confirmação de uma ação é vinculada ao usuário, expira em dez minutos e é consumida uma única vez por atualização condicional no banco.

O histórico **Suas últimas 30 ações** permite revisar o resultado mesmo após uma interrupção da conexão. Se uma ação aparece como execução iniciada ou falhou, confira o registro antes de reenviar: a operação pode ter sido concluída antes de a resposta falhar. Não há repetição automática de alterações após erros.

Limites por comando: sete rodadas com Claude, até 40 chamadas de ferramentas, até 15 alterações e 120 segundos no laço de execução. Há limite de dez comandos por minuto por usuário e apenas um comando ativo por vez. O histórico de conversa fica em memória no navegador, até nova conversa ou recarga. Requisições e ações ficam no banco para deduplicação, controle de uso e auditoria; configure a retenção conforme a necessidade do ambiente.

O texto do comando e dados consultados são enviados à Anthropic. Credenciais, imagens e cadastros de acesso são filtrados das consultas. A chave sai do servidor apenas no header destinado à API da Anthropic. Os testes usam uma chave fictícia e respostas simuladas, sem consumir saldo da API.

## Verificação

`npx tsx --test tests/assistant.test.ts tests/expense-payments.test.ts`

`npx tsc --noEmit`

`npm run build`

Referências: [Messages API](https://platform.claude.com/docs/en/api/messages/create), [modelos do Claude](https://platform.claude.com/docs/en/about-claude/models/overview), [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).
