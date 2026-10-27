# Faturas, investimentos e Caixa

As faturas usam o **mês do vencimento**. Compras no dia de fechamento entram no ciclo que fecha nesse dia; compras posteriores entram no próximo. Se o vencimento é igual ou anterior ao fechamento, vence no mês seguinte. Dias 29–31 usam o último dia disponível em meses curtos.

Em **Financeiro → Cartões → Editar**, configure os dois dias de cada cartão. Cartões antigos continuam cadastrados, com datas vazias até configuração. Consulte meses anteriores/futuros no seletor. Cada cartão mostra total, valor efetivamente pago, restante e situação. “Informar valor pago” substitui o total acumulado pago daquela fatura; não gera outra despesa nem retirada do Caixa. Pagamento acima do total aparece como crédito, sem transferi-lo automaticamente para outro mês.

Em **Investimentos**, cadastro e edição permitem vincular um cartão opcional. A data passa a representar a compra. As parcelas são geradas com vencimento na fatura correspondente, em centavos, preservando o total exato. R$ 100 em três parcelas produz R$ 33,34 + R$ 33,33 + R$ 33,33. Edições reaproveitam os IDs e atualizam o cartão; reduzir o número remove apenas as parcelas excedentes desse investimento. As parcelas geradas são editadas pelo investimento, inclusive a partir da aba Avulsas.

O resumo financeiro conta as despesas vinculadas, sem somar novamente o investimento. Despesas fixas continuam recorrendo mensalmente. O progresso de investimentos é uma **previsão por data**, não uma confirmação de pagamento.

Quando os lançamentos já existem manualmente, marque “Usar despesas já cadastradas” e selecione cada parcela correspondente por valor/data. A associação reaproveita as despesas, sem criar cópias. A migração só associa lotes antigos completos e sem ambiguidade; registros não reconhecidos são preservados. Editar um investimento antigo sem lote reconhecido preserva essa condição até uma associação explícita.

Alterar fechamento/vencimento recalcula parcelas vinculadas, inclusive as anteriores. Pagamentos informados continuam associados ao mesmo cartão/mês. Excluir um investimento mantém suas despesas, como já ocorria no sistema, e preserva o período de fatura gravado em cada parcela. Despesas independentes podem ser editadas normalmente.

Retiradas do Caixa agora acompanham edição/exclusão da despesa ou investimento de origem. “Remover retirada” cancela a retirada do saldo, preserva seu registro e desmarca a origem Caixa no cadastro vinculado. A despesa continua existindo. A restauração técnica pode limpar `voidedAt` após conferir a origem e o valor; o aplicativo não oferece botão de restauração nesta versão.

## Implantação e verificação

1. Execute `npm run test:finance`, `npm run test:security` e `npm run build`.
2. Em PostgreSQL descartável, teste primeiro o schema anterior, dados antigos e a migração `20261027120000_card_invoices_investment_links/migration.sql`. Nunca use `db push` no banco de produção.
3. Execute `npm run test:finance:db` com `TEST_DATABASE_URL` apontando explicitamente para um banco local `finance_test_*`. A suíte reverte suas próprias fixtures ao concluir.
4. Antes da publicação, aplique somente a migração aditiva com `npx tsx scripts/prepare-finance.ts --project-ref=REF --backup-dir <pasta-privada> --apply`, usando o ambiente correto. O projeto informado deve corresponder ao banco e ao Supabase Auth. Sem `--apply`, apenas verifica o estado. O comando salva uma cópia privada das tabelas financeiras antes de mudar o schema.
5. Publique a aplicação e confira autenticação, Cartões, Investimentos, Caixa e a integração Asaas existente. Não execute automaticamente migrações antigas de outros módulos.

O código anterior continua compatível com as colunas adicionais. Se houver rollback de aplicação, preserve o schema e o backup; não remova tabelas/colunas para reverter a interface.
