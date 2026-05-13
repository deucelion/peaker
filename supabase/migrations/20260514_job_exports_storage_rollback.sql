-- Faz 12.1 — Async export storage bucket rollback.
-- Bucket içinde dosya varsa drop edilemez; önce manuel temizlik gerekli.

drop policy if exists peaker_job_exports_org_read on storage.objects;
delete from storage.buckets where id = 'peaker-job-exports';
