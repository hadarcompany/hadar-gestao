-- CreateTable
CREATE TABLE "social_accounts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT,
    "tokenEncrypted" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "tokenRefreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "connectedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_oauth_sessions" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "resultEncrypted" TEXT,

    CONSTRAINT "social_oauth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_assets" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "reservedBytes" INTEGER NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "format" TEXT NOT NULL,
    "media" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "externalPostId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "progress" JSONB,
    "publishStartedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockToken" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_worker_state" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,

    CONSTRAINT "social_worker_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_accounts_clientId_idx" ON "social_accounts"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_provider_externalId_key" ON "social_accounts"("provider", "externalId");

-- CreateIndex
CREATE INDEX "social_oauth_sessions_expiresAt_idx" ON "social_oauth_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "social_assets_path_key" ON "social_assets"("path");

-- CreateIndex
CREATE INDEX "social_assets_clientId_idx" ON "social_assets"("clientId");

-- CreateIndex
CREATE INDEX "social_posts_status_nextAttemptAt_scheduledAt_idx" ON "social_posts"("status", "nextAttemptAt", "scheduledAt");

-- CreateIndex
CREATE INDEX "social_posts_clientId_createdAt_idx" ON "social_posts"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_assets" ADD CONSTRAINT "social_assets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "social_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- New tables expose no records to anonymous/authenticated Supabase clients.
ALTER TABLE social_accounts ADD CONSTRAINT social_accounts_provider_check CHECK (provider IN ('INSTAGRAM','FACEBOOK'));
ALTER TABLE social_assets ADD CONSTRAINT social_assets_size_check CHECK (bytes > 0 AND "reservedBytes" >= bytes);
ALTER TABLE social_assets ADD CONSTRAINT social_assets_mime_check CHECK (mime IN ('image/jpeg','video/mp4'));
ALTER TABLE social_posts ADD CONSTRAINT social_posts_status_check CHECK (status IN ('DRAFT','PENDING_APPROVAL','SCHEDULED','PROCESSING','PUBLISHED','FAILED','UNCERTAIN','CANCELLED'));
ALTER TABLE social_posts ADD CONSTRAINT social_posts_format_check CHECK (format IN ('POST','CAROUSEL','REEL','STORY'));
ALTER TABLE social_posts ADD CONSTRAINT social_posts_media_check CHECK (jsonb_typeof(media) = 'array');
ALTER TABLE social_posts ADD CONSTRAINT social_posts_approval_check CHECK (status NOT IN ('SCHEDULED','PROCESSING','PUBLISHED') OR ("approvedAt" IS NOT NULL AND "approvedById" IS NOT NULL AND "scheduledAt" IS NOT NULL));
DO $$
DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['social_accounts','social_assets','social_posts','social_oauth_sessions','social_worker_state'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hadar_runtime_20261020') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO hadar_runtime_20261020', relation_name);
      EXECUTE format('CREATE POLICY hadar_runtime_access ON public.%I TO hadar_runtime_20261020 USING (true) WITH CHECK (true)', relation_name);
    END IF;
  END LOOP;
END $$;
