-- ============================================================================
-- FAZ 32: Oyuncular dizini icin "son tamamlanan ders" DB-side agregasyonu.
--
-- Onceki durum: listManagementDirectory org'daki TUM tamamlanmis ozel ders
-- seanslarini cekip bellekte sporcu basina ilkini aliyordu (yillar icinde
-- on binlerce satir). Bu fonksiyon distinct on ile sporcu basina tek satir
-- dondurur. Uygulama RPC yoksa eski sorguya fallback yapar.
-- ============================================================================

create or replace function public.peaker_directory_last_completed_sessions(p_org_id uuid)
returns table(athlete_id uuid, last_completed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (s.athlete_id)
    s.athlete_id,
    s.starts_at as last_completed_at
  from public.private_lesson_sessions s
  where s.organization_id = p_org_id
    and s.status = 'completed'
    and s.athlete_id is not null
  order by s.athlete_id, s.starts_at desc;
$$;

revoke all on function public.peaker_directory_last_completed_sessions(uuid) from public;
revoke all on function public.peaker_directory_last_completed_sessions(uuid) from anon;
revoke all on function public.peaker_directory_last_completed_sessions(uuid) from authenticated;

comment on function public.peaker_directory_last_completed_sessions(uuid) is
  'Faz 32 — Oyuncular dizini: sporcu basina son tamamlanan ozel ders (distinct on).';
