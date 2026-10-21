CREATE TABLE public.social_metric_days (
 id TEXT PRIMARY KEY, "accountId" TEXT NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
 day TEXT NOT NULL CHECK(day ~ '^\d{4}-\d{2}-\d{2}$'), followers INTEGER, follows INTEGER, unfollows INTEGER,
 "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "social_metric_days_accountId_day_key" ON public.social_metric_days("accountId",day);
CREATE TABLE public.social_media_metrics (
 id TEXT PRIMARY KEY, "accountId" TEXT NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
 "externalId" TEXT NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('POST','REEL','STORY')), "publishedAt" TIMESTAMP(3) NOT NULL,
 data JSONB NOT NULL CHECK(jsonb_typeof(data)='object'), "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "fetchedAt" TIMESTAMP(3), "attemptedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "social_media_metrics_accountId_externalId_key" ON public.social_media_metrics("accountId","externalId");
CREATE INDEX "social_media_metrics_accountId_publishedAt_idx" ON public.social_media_metrics("accountId","publishedAt");
CREATE INDEX "social_media_metrics_accountId_attemptedAt_idx" ON public.social_media_metrics("accountId","attemptedAt");
CREATE TABLE public.social_analytics_state (
 "accountId" TEXT PRIMARY KEY REFERENCES public.social_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
 "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastCollectedAt" TIMESTAMP(3),
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lockToken" TEXT, "lockedAt" TIMESTAMP(3), warning TEXT
);
CREATE INDEX "social_analytics_state_nextAttemptAt_idx" ON public.social_analytics_state("nextAttemptAt");
DO $$
DECLARE relation_name text;
BEGIN
 FOREACH relation_name IN ARRAY ARRAY['social_metric_days','social_media_metrics','social_analytics_state'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',relation_name);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='hadar_runtime_20261020') THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO hadar_runtime_20261020',relation_name);
   EXECUTE format('CREATE POLICY hadar_runtime_access ON public.%I TO hadar_runtime_20261020 USING (true) WITH CHECK (true)',relation_name);
  END IF;
 END LOOP;
END $$;
