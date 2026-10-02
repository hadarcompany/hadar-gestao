# Despesas fixas recorrentes

Cada registro da aba **Despesas Fixas** faz parte do orçamento mensal permanente, independentemente do mês/ano em que foi cadastrado. A lista não tem filtro mensal; uma despesa só sai quando o usuário confirma sua exclusão. Os cadastros existentes são preservados, sem mesclar registros distintos com nomes semelhantes.

O valor representa o custo **por mês**. O resumo financeiro multiplica a base mensal pela quantidade de meses do período e inclui a mesma base em cada ponto do gráfico. Categorias, dashboard e pró-labore seguem essa regra. Edições e exclusões mudam a base de todos os meses consultados, inclusive períodos anteriores: esta lista é o orçamento recorrente atual, não um histórico de pagamentos mensais.

`month`/`year` permanecem no banco como metadados legados para compatibilidade; não filtram a recorrência. Novos cadastros não precisam informar esses campos. Não são criadas cópias mensais nem lançamentos automáticos de pagamento. Despesas avulsas e movimentações de caixa continuam usando seus lançamentos próprios; marcar reserva no cadastro cria apenas a retirada solicitada naquele momento.

Verificação: `npx tsx --test tests/fixed-expenses.test.ts`.
