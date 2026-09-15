-- Ativa Row Level Security em TODAS as tabelas do schema public.
-- Sem políticas, isso bloqueia a API pública do Supabase (chaves anon/authenticated)
-- para leitura e escrita. O sistema não é afetado: ele acessa os dados pelo Prisma,
-- com o usuário postgres, que ignora RLS. O login continua pelo Supabase Auth.
-- Pode ser executado de novo sem efeito colateral. Rode também depois de criar
-- tabelas novas (db push ou SQL), porque elas nascem sem RLS.

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- Conferência: todas as linhas devem vir com rls_ativo = true.
SELECT tablename, rowsecurity AS rls_ativo
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
