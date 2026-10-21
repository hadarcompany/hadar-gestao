ALTER TABLE public.social_posts ADD COLUMN options JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.social_posts ADD COLUMN "seriesId" TEXT;
ALTER TABLE public.social_posts ADD COLUMN "occurrenceKey" TEXT;
ALTER TABLE public.social_posts ADD COLUMN "afterPublishState" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE public.social_posts ADD COLUMN "afterPublishError" TEXT;
CREATE TABLE public.social_series (
 id TEXT PRIMARY KEY, "clientId" TEXT NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "accountId" TEXT NOT NULL REFERENCES public.social_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 caption TEXT NOT NULL, format TEXT NOT NULL, media JSONB NOT NULL, options JSONB NOT NULL DEFAULT '{}',
 "assetIds" TEXT[] NOT NULL, weekdays INTEGER[] NOT NULL, time TEXT NOT NULL,
 "startDate" TEXT NOT NULL, "endDate" TEXT, active BOOLEAN NOT NULL DEFAULT true,
 "approvedAt" TIMESTAMP(3), "approvedById" TEXT, "createdById" TEXT NOT NULL,
 "lastExpandedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT social_series_weekdays_check CHECK (cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[0,1,2,3,4,5,6]),
 CONSTRAINT social_series_format_check CHECK (format IN ('POST','CAROUSEL','REEL','STORY')),
 CONSTRAINT social_series_time_check CHECK (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 CONSTRAINT social_series_media_check CHECK (jsonb_typeof(media)='array')
);
ALTER TABLE public.social_posts ADD CONSTRAINT "social_posts_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES public.social_series(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_options_check CHECK (jsonb_typeof(options)='object');
ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_after_publish_check CHECK ("afterPublishState" IN ('NONE','RUNNING','DONE','WARNING'));
CREATE UNIQUE INDEX "social_posts_seriesId_occurrenceKey_key" ON public.social_posts("seriesId","occurrenceKey");
CREATE INDEX "social_series_clientId_active_idx" ON public.social_series("clientId",active);
CREATE INDEX "social_series_active_lastExpandedAt_idx" ON public.social_series(active,"lastExpandedAt");
CREATE INDEX social_posts_options_gin_idx ON public.social_posts USING gin(options jsonb_path_ops);
CREATE INDEX social_series_assets_gin_idx ON public.social_series USING gin("assetIds");
CREATE TABLE public.social_report_snapshots (
 id TEXT PRIMARY KEY, "accountId" TEXT NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
 "rangeKey" TEXT NOT NULL, data JSONB NOT NULL, "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "social_report_snapshots_accountId_rangeKey_key" ON public.social_report_snapshots("accountId","rangeKey");
DO $$
DECLARE relation_name text;
BEGIN
 FOREACH relation_name IN ARRAY ARRAY['social_series','social_report_snapshots'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',relation_name);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='hadar_runtime_20261020') THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO hadar_runtime_20261020',relation_name);
   EXECUTE format('CREATE POLICY hadar_runtime_access ON public.%I TO hadar_runtime_20261020 USING (true) WITH CHECK (true)',relation_name);
  END IF;
 END LOOP;
END $$;
