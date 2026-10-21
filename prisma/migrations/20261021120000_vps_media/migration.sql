ALTER TABLE public.social_assets ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'SUPABASE';
ALTER TABLE public.social_assets ADD COLUMN state TEXT NOT NULL DEFAULT 'UPLOADING';
ALTER TABLE public.social_assets ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE public.social_assets SET state = 'AVAILABLE' WHERE "verifiedAt" IS NOT NULL;
ALTER TABLE public.social_assets DROP CONSTRAINT IF EXISTS social_assets_size_check;
ALTER TABLE public.social_assets ADD CONSTRAINT social_assets_size_check CHECK (
  bytes > 0 AND ((state = 'DELETED' AND "reservedBytes" = 0) OR (state <> 'DELETED' AND "reservedBytes" >= bytes))
);
ALTER TABLE public.social_assets ADD CONSTRAINT social_assets_state_check CHECK (state IN ('UPLOADING','AVAILABLE','DELETING','DELETED'));
ALTER TABLE public.social_assets ADD CONSTRAINT social_assets_storage_check CHECK ("storageProvider" IN ('SUPABASE','VPS'));
CREATE INDEX "social_assets_state_createdAt_idx" ON public.social_assets(state, "createdAt");
CREATE INDEX social_posts_media_gin_idx ON public.social_posts USING gin(media jsonb_path_ops);
