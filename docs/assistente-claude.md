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
2. Como administrador, acesse **Configurações > Integrações > Claude**, informe a chave e clique em **Testar conexão** e **Salvar**. O campo fica vazio depois de salvar; deixe-o vazio para manter a chave ao mudar o modelo. O teste usa uma chamada curta da API, sem ferramentas ou alterações no aplicativo. A conexão só é testada quando solicitada pelo botão.
3. Aplique as migrações `20261002150000_add_assistant_actions` e `20261002180000_add_assistant_integration`. Elas criam tabelas com RLS ativado. A funcionalidade de cartões depende também de `20261002120000_add_credit_cards`.
4. Gere o cliente Prisma com `npx prisma generate` e publique a aplicação. O servidor precisa suportar a duração configurada de até 180 segundos para comandos de várias etapas.
5. Abra o Assistente e teste primeiro um comando de consulta, depois uma tarefa de teste. O assistente mostra um aviso de configuração quando a chave está ausente.

Use `prisma migrate deploy` somente se o histórico das migrações estiver sincronizado; em bancos mantidos por SQL manual, aplique somente os scripts necessários pelo procedimento do ambiente.

A integração é compartilhada pelos usuários desta instalação, como as outras integrações atuais. A chave cadastrada no aplicativo tem prioridade sobre `ANTHROPIC_API_KEY`; o modelo padrão é `claude-sonnet-4-6`. Remover a integração apaga a chave armazenada e desativa o Assistente, inclusive se houver uma chave legada no ambiente. Um novo cadastro reativa a integração sem redeploy. Instalações de clientes diferentes devem ter bancos/ambientes separados; esta alteração não implementa isolamento de empresas em um mesmo banco.

As rotas de integração exigem administrador e não devolvem a chave, nem a versão criptografada. O banco guarda AES-256-GCM com IV aleatório. O segredo de criptografia vem de `INTEGRATIONS_ENCRYPTION_KEY` (opcional, estável, mínimo 32 caracteres) ou de uma derivação com domínio separado da `SUPABASE_SERVICE_ROLE_KEY` já usada no servidor. O formato armazenado identifica a origem, permitindo ativar um segredo dedicado sem invalidar chaves anteriores. Ao rotacionar o segredo que protege um registro, cadastre novamente a chave da API. Nunca use `NEXT_PUBLIC_` para credenciais. Para desenvolvimento local, use `.env.local`; não acrescente credenciais ao `.env` versionado.

## PDFs e imagens

Use o botão de clipe ao lado de **Falar** para anexar PDFs, JPG, PNG, GIF ou WebP. Veja a prévia/nome e remova arquivos antes do envio, se necessário. É possível enviar só os arquivos ou combinar com texto/voz: “Crie tarefas com base neste planejamento” ou “Explique esta imagem”. PDFs devem ser válidos e sem senha; documentos muito longos podem precisar ser divididos por conta dos limites do provedor.

Limites da aplicação: oito anexos e 3 MB somados por conversa, incluindo arquivos de mensagens anteriores. Formato, assinatura e tamanho são validados no servidor. Arquivos são enviados como blocos nativos de documento/imagem à API, sem aceitar URLs de arquivos. Os anexos ficam em memória no navegador e continuam no contexto das perguntas seguintes, inclusive quando o texto antigo sai da janela de 21 mensagens. **Nova conversa** ou recarregar a página limpa esse contexto. Os arquivos não são gravados no banco da aplicação; resultados/ações extraídos deles podem aparecer no histórico de ações. PDFs e imagens são dados de contexto, não autorização para instruções embutidas no arquivo.

## Controle de execução

Cada comando tem um `requestId` exclusivo. Reenviar a mesma requisição retorna o resultado armazenado ou informa que ainda está sendo processada, sem repetir as alterações. Ações idênticas no mesmo comando têm uma chave de deduplicação. A confirmação de uma ação é vinculada ao usuário, expira em dez minutos e é consumida uma única vez por atualização condicional no banco.

O histórico **Suas últimas 30 ações** permite revisar o resultado mesmo após uma interrupção da conexão. Se uma ação aparece como execução iniciada ou falhou, confira o registro antes de reenviar: a operação pode ter sido concluída antes de a resposta falhar. Não há repetição automática de alterações após erros.

Limites por comando: sete rodadas com Claude, até 40 chamadas de ferramentas, até 15 alterações e 120 segundos no laço de execução. Há limite de dez comandos por minuto por usuário e apenas um comando ativo por vez. O histórico de conversa fica em memória no navegador, até nova conversa ou recarga. Requisições e ações ficam no banco para deduplicação, controle de uso e auditoria; configure a retenção conforme a necessidade do ambiente.

O texto do comando, anexos enviados pelo usuário e dados consultados são enviados à Anthropic. Credenciais, imagens do cadastro e cadastros de acesso são filtrados das consultas. A chave sai do servidor apenas no header destinado à API da Anthropic. Os testes usam uma chave fictícia e respostas simuladas, sem consumir saldo da API.

## Verificação

`npx tsx --test tests/assistant.test.ts tests/assistant-attachments.test.ts tests/assistant-integration.test.ts tests/expense-payments.test.ts tests/fixed-expenses.test.ts`

`npx tsc --noEmit`

`npm run build`

Referências: [Messages API](https://platform.claude.com/docs/en/api/messages/create), [PDFs](https://platform.claude.com/docs/en/build-with-claude/pdf-support), [imagens](https://platform.claude.com/docs/en/build-with-claude/vision), [modelos do Claude](https://platform.claude.com/docs/en/about-claude/models/overview), [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).
