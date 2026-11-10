# Materiais recebidos dos clientes — Insider

The feature is enabled only with `INSTANCE_BRAND=insider` and `MATERIALS_ENABLED=true`. Hadar remains the default brand and its production deployment is not changed by the Insider release.

Administrators open **Clientes → cliente → Visão Geral → Link de envio de materiais** to create, copy, open or disable a link. The company is fixed by the link, not accepted from public form input. Disabling a link immediately prevents new requests and final submissions. Existing tasks and attachments remain intact.

The public form requires observations and an explicit editing choice. `MATERIALS_EDITOR_EMAIL` selects Guilherme's existing account for editing; `MATERIALS_READY_EMAIL` selects Daniela's existing account for ready material. No accounts or permissions are created or changed by submissions. The technical task creator/uploader is the administrator who created the link; the task description explicitly identifies the public client submission as its source.

## Deployment

Apply `deploy/materials/schema.sql` only to the intended Insider database after an encrypted, restore-verified backup. It adds two tables and enables RLS without anonymous/authenticated grants. Do not push an unrelated full schema to an existing customer database.

Set `MATERIALS_LINK_SECRET` and `MATERIALS_STORAGE_SECRET` to independent random secrets of at least 32 characters. Save them outside the source tree. `MATERIALS_STORAGE_URL` is the HTTPS base URL for the dedicated spool, including its path prefix and trailing slash. Runtime branding must remain dynamic; the client `BrandProvider` is a function component so the context provider is not exported directly across the server/client boundary.

Run `deploy/materials/server.py` as its own unprivileged service with a separate key, directory and quota. It reuses the bounded spool transport from `deploy/media/server.py`; do not replace or restart the existing Hadar media service. Configure the `insider-materials` tenant, allow only the Insider HTTPS origin, bind to the private Docker bridge, and allow only the Caddy container through the firewall. Caddy strips `/material-storage/`, caps chunk requests at 9 MB, and caps `/api/public/materials/*` JSON at 32 KB. Do not expose port 8092 publicly.

The installed quota is 5 GB, with a 10 GB disk reserve. Each form accepts up to ten files and 500 MB total: JPEG/PNG/WebP up to 20 MB each, MP4 up to 200 MB. Chunks are 8 MB and streamed to disk. File signatures, expected lengths, action-specific tickets, expiry, quota and immutable chunk retries are checked by the storage service. Public JSON never contains the storage signing key. Requests are limited to twenty starts per client link per hour. A submission UUID is reused on retry; advisory locking prevents duplicate tasks under concurrent submissions.

Task attachment access continues through the authenticated task routes. Existing database-backed attachments keep their previous behavior. New materials use typed internal storage references and retain their original bytes. No public file listing or permanent public download URL is provided.

Run `deploy/materials/cleanup.py` daily as the installed timer. It first inventories database references and aborts if that fails. Attached task files are retained. Unreferenced incomplete uploads are removed after two days; unreferenced completed uploads after seven days. Active drafts are protected for 24 hours. Task material retention is independent from social publishing retention.

Set the Insider backup configuration's `localMediaDirectory` to its private material tenant directory. The existing backup job encrypts and verifies media blobs by hash, and the Windows pull job fetches the blobs referenced by retained manifests. Database restore alone does not restore externally stored originals; retain the corresponding encrypted media blobs and manifest.

## Validation

Run `tsx --test tests/materials.test.ts`, `python tests/materials-storage.test.py`, and the existing security, page-access, list-performance, media and backup tests. `scripts/test-materials.cjs` is restricted to a disposable localhost database and checks client isolation, both assignments, concurrent idempotency, signed storage operations, revocation, trial expiry and rate limits. Verify hydration in a browser using a private preview before activating the instance, then submit a real image, download its original and compare bytes. Restore the prior image/env/symlink if that browser check fails.
