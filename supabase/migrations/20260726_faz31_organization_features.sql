-- FAZ 31.3.2 — Organization Feature Platform persistence
-- Runtime truth: organizations.features (materialized effective entitlements)
--
-- Rollback (manual, veri kaybi — feature kolonlari silinir):
--   alter table public.organizations drop constraint if exists organizations_features_revision_check;
--   alter table public.organizations drop constraint if exists organizations_feature_preset_check;
--   alter table public.organizations drop column if exists features_revision;
--   alter table public.organizations drop column if exists features;
--   alter table public.organizations drop column if exists feature_overrides;
--   alter table public.organizations drop column if exists feature_preset;

alter table public.organizations
  add column if not exists feature_preset text not null default 'club_professional';

alter table public.organizations
  add column if not exists feature_overrides jsonb not null default '{}'::jsonb;

alter table public.organizations
  add column if not exists features jsonb not null default '{}'::jsonb;

alter table public.organizations
  add column if not exists features_revision integer not null default 1;

alter table public.organizations
  drop constraint if exists organizations_feature_preset_check;

alter table public.organizations
  add constraint organizations_feature_preset_check
  check (
    feature_preset in (
      'academy_lite',
      'academy_plus',
      'club_professional',
      'club_enterprise',
      'custom'
    )
  );

alter table public.organizations
  drop constraint if exists organizations_features_revision_check;

alter table public.organizations
  add constraint organizations_features_revision_check
  check (features_revision >= 1);

-- Club Professional backfill — mevcut musteriler tam yetki (bugunku Peaker davranisi).
update public.organizations
set
  feature_preset = 'club_professional',
  feature_overrides = '{}'::jsonb,
  features = jsonb_build_object(
    'schemaVersion', 1,
    'core', true,
    'athlete', true,
    'private_lessons', true,
    'finance', true,
    'communications', true,
    'audit', true,
    'insight.performance', true,
    'insight.field_tests', true,
    'insight.body_measurements', true,
    'insight.development_hub', true,
    'insight.training_reports', true,
    'insight.wellness_archive', true
  ),
  features_revision = 1;

alter table public.organizations
  alter column features set default jsonb_build_object(
    'schemaVersion', 1,
    'core', true,
    'athlete', true,
    'private_lessons', true,
    'finance', true,
    'communications', true,
    'audit', true,
    'insight.performance', true,
    'insight.field_tests', true,
    'insight.body_measurements', true,
    'insight.development_hub', true,
    'insight.training_reports', true,
    'insight.wellness_archive', true
  );
