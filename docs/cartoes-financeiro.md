# Cartões e formas de pagamento de despesas

Em **Financeiro → Cartões**, cadastre o nome do cartão e, opcionalmente, banco e bandeira. A cor identifica o cartão visualmente. Não há campos para número, validade ou código de segurança.

Nas despesas **Fixas** e **Avulsas**, selecione Pix, boleto, cartão de crédito, dinheiro, transferência bancária ou outro. Ao selecionar crédito, escolha um cartão cadastrado. A forma de pagamento e o nome do cartão aparecem na lista de despesas e podem ser alterados ao editar.

O desconto da reserva do caixa continua sendo independente da forma de pagamento. A identificação dos cartões não cria faturas, limites ou lançamentos adicionais no financeiro.

Cartões inativos não podem ser associados a novas despesas, mas continuam nas despesas antigas. Cartões com despesas vinculadas não podem ser excluídos; desative-os pelo formulário de edição.

## Banco e publicação

A migração `prisma/migrations/20261002120000_add_credit_cards/migration.sql` cria `credit_cards`, o enum `ExpensePaymentMethod` e as colunas opcionais `paymentMethod` e `creditCardId` em `fixed_expenses` e `variable_expenses`. Registros antigos continuam com pagamento não informado; não é possível deduzir sua forma de pagamento pela origem do caixa.

Em ambientes com histórico de migrações Prisma sincronizado, aplique as migrações com `npx prisma migrate deploy` antes de publicar a aplicação. Em bancos mantidos por SQL manual, aplique somente o SQL desta migração pelo SQL Editor, seguindo o procedimento do ambiente. Não use `db:push` para aplicar indiscriminadamente outras diferenças de schema.

Depois gere o cliente com `npx prisma generate` e publique a aplicação. A migração foi aplicada ao banco configurado do projeto em 2 de outubro de 2026, durante a publicação desta funcionalidade.

As APIs exigem permissão de visualização do financeiro para consulta e de edição para alterações. A tabela de cartões nasce com RLS ativado, bloqueando o acesso direto pela API pública do Supabase; o Prisma continua acessando pelo usuário do banco usado pelo sistema.

Verificação das regras de pagamento: `npx tsx --test tests/expense-payments.test.ts`.
