-- Additive, Insider-only migration. Never run a whole-schema db push here.
CREATE TABLE IF NOT EXISTS public.client_material_links (
 id text PRIMARY KEY,
 "clientId" text NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
 "createdById" text NOT NULL REFERENCES public.users(id),
 enabled boolean NOT NULL DEFAULT true,
 "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.client_material_submissions (
 id text PRIMARY KEY,
 "linkId" text NOT NULL REFERENCES public.client_material_links(id) ON DELETE CASCADE,
 assets jsonb NOT NULL,
 "taskId" text UNIQUE REFERENCES public.tasks(id) ON DELETE SET NULL,
 submitted boolean NOT NULL DEFAULT false,
 "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS client_material_submissions_link_created_idx ON public.client_material_submissions ("linkId", "createdAt");
ALTER TABLE public.client_material_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_material_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_material_links, public.client_material_submissions FROM anon, authenticated;
