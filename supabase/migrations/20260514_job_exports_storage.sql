-- Faz 12.1 — Async export job çıktıları için Supabase Storage bucket.
--
-- Hedef:
--   Worker (`export.audit`, `export.payments`) job'ları CSV çıktısını
--   `peaker-job-exports` bucket'ına yazar; kullanıcı bildirim üzerinden
--   indirir. Sync path (mevcut server action -> blob) etkilenmez.
--
-- Güvenlik:
--   - Bucket private (public=false). Yalnızca signed URL ile indirilebilir.
--   - service_role full access; authenticated rolüne yalnızca kendi
--     organization_id prefix'i altındaki dosyalara select izni verilir.
--
-- Rollback:
--   `20260514_job_exports_storage_rollback.sql` ile drop edilir.

insert into storage.buckets (id, name, public)
values ('peaker-job-exports', 'peaker-job-exports', false)
on conflict (id) do nothing;

-- RLS: service_role her şeyi yapabilir (default). Authenticated kullanıcılar
-- yalnızca path prefix `<organization_id>/...` ile başlayan dosyaları okuyabilir.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'peaker_job_exports_org_read'
  ) then
    execute $pol$
      create policy peaker_job_exports_org_read
        on storage.objects
        for select to authenticated
        using (
          bucket_id = 'peaker-job-exports'
          and exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('admin', 'super_admin')
              and (
                p.role = 'super_admin'
                or (storage.foldername(name))[1] = p.organization_id::text
              )
          )
        )
    $pol$;
  end if;
end$$;

comment on table storage.objects is
  'Peaker storage objects. peaker-job-exports prefix: <organization_id>/<job_id>/<filename>.csv';
