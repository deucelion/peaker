-- FAZ 32.2 — Organization Branding Platform persistence
-- Runtime truth: organizations.branding + organizations.branding_revision
--
-- Rollback (manual, veri kaybi — branding kolonlari silinir):
--   alter table public.organizations drop constraint if exists organizations_branding_revision_check;
--   alter table public.organizations drop column if exists branding_revision;
--   alter table public.organizations drop column if exists branding;

alter table public.organizations
  add column if not exists branding jsonb not null default '{}'::jsonb;

alter table public.organizations
  add column if not exists branding_revision integer not null default 1;

alter table public.organizations
  drop constraint if exists organizations_branding_revision_check;

alter table public.organizations
  add constraint organizations_branding_revision_check
  check (branding_revision >= 1);

-- Peaker default branding backfill — mevcut organizasyonlar foundation default ile hizalanir.
update public.organizations
set
  branding = jsonb_build_object(
    'schemaVersion', 1,
    'brandingRevision', 0,
    'theme', jsonb_build_object(
      'primary', '#7c3aed',
      'secondary', '#5b21b6',
      'accent', '#7c3aed',
      'background', '#09090b',
      'surface', '#121215',
      'textPrimary', '#ffffff',
      'textSecondary', '#a1a1aa',
      'sidebarBackground', '#09090b',
      'sidebarText', '#71717a',
      'sidebarActive', '#ffffff'
    ),
    'assets', jsonb_build_object(
      'logo', jsonb_build_object(
        'assetId', 'peaker-default-logo',
        'kind', 'logo',
        'storagePath', 'branding/defaults/logo.svg',
        'contentType', 'image/svg+xml',
        'updatedAt', '2026-01-01T00:00:00.000Z'
      ),
      'mark', jsonb_build_object(
        'assetId', 'peaker-default-mark',
        'kind', 'mark',
        'storagePath', 'branding/defaults/mark.svg',
        'contentType', 'image/svg+xml',
        'updatedAt', '2026-01-01T00:00:00.000Z'
      ),
      'favicon', jsonb_build_object(
        'assetId', 'peaker-default-favicon',
        'kind', 'favicon',
        'storagePath', 'branding/defaults/favicon.ico',
        'contentType', 'image/x-icon',
        'updatedAt', '2026-01-01T00:00:00.000Z'
      )
    ),
    'application', jsonb_build_object(
      'appName', 'PEAKER',
      'shortName', 'Peaker'
    ),
    'sidebar', jsonb_build_object(
      'background', '#09090b',
      'text', '#71717a',
      'active', '#ffffff'
    ),
    'pdf', jsonb_build_object(
      'title', 'PEAKER Rapor'
    ),
    'email', jsonb_build_object(
      'title', 'PEAKER'
    )
  ),
  branding_revision = 1;

alter table public.organizations
  alter column branding set default jsonb_build_object(
    'schemaVersion', 1,
    'brandingRevision', 0,
    'theme', jsonb_build_object(
      'primary', '#7c3aed',
      'secondary', '#5b21b6',
      'accent', '#7c3aed',
      'background', '#09090b',
      'surface', '#121215',
      'textPrimary', '#ffffff',
      'textSecondary', '#a1a1aa',
      'sidebarBackground', '#09090b',
      'sidebarText', '#71717a',
      'sidebarActive', '#ffffff'
    ),
    'assets', jsonb_build_object(
      'logo', jsonb_build_object(
        'assetId', 'peaker-default-logo',
        'kind', 'logo',
        'storagePath', 'branding/defaults/logo.svg',
        'contentType', 'image/svg+xml',
        'updatedAt', '2026-01-01T00:00:00.000Z'
      ),
      'mark', jsonb_build_object(
        'assetId', 'peaker-default-mark',
        'kind', 'mark',
        'storagePath', 'branding/defaults/mark.svg',
        'contentType', 'image/svg+xml',
        'updatedAt', '2026-01-01T00:00:00.000Z'
      ),
      'favicon', jsonb_build_object(
        'assetId', 'peaker-default-favicon',
        'kind', 'favicon',
        'storagePath', 'branding/defaults/favicon.ico',
        'contentType', 'image/x-icon',
        'updatedAt', '2026-01-01T00:00:00.000Z'
      )
    ),
    'application', jsonb_build_object(
      'appName', 'PEAKER',
      'shortName', 'Peaker'
    ),
    'sidebar', jsonb_build_object(
      'background', '#09090b',
      'text', '#71717a',
      'active', '#ffffff'
    ),
    'pdf', jsonb_build_object(
      'title', 'PEAKER Rapor'
    ),
    'email', jsonb_build_object(
      'title', 'PEAKER'
    )
  );
