-- ============================================================================
-- FAZ 32: Super admin paneli icin org-bazinda DB-side agregasyon RPC'si.
--
-- Onceki durum: /super-admin sayfasi TUM platformun profiles,
-- training_schedule ve training_participants satirlarini cekip bellekte
-- sayiyordu (platform buyudukce dogrusal olarak yavaslayan istek).
--
-- Bu fonksiyon org basina sayimlari tek sorguda dondurur. Uygulama RPC
-- bulunamazsa eski taramalara fallback yapar.
-- ============================================================================

create or replace function public.peaker_super_admin_org_summaries(
  p_today_start timestamptz,
  p_today_end timestamptz
)
returns table(
  organization_id uuid,
  athletes bigint,
  coaches bigint,
  total_lessons bigint,
  today_lessons bigint,
  last_activity_at timestamptz,
  attendance_marked_today bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id as organization_id,
    coalesce(p.athletes, 0) as athletes,
    coalesce(p.coaches, 0) as coaches,
    coalesce(l.total, 0) as total_lessons,
    coalesce(l.today, 0) as today_lessons,
    l.last_activity_at,
    coalesce(a.marked_today, 0) as attendance_marked_today
  from public.organizations o
  left join (
    select
      pr.organization_id,
      count(*) filter (where pr.role = 'sporcu') as athletes,
      count(*) filter (where pr.role = 'coach') as coaches
    from public.profiles pr
    where pr.organization_id is not null
    group by 1
  ) p on p.organization_id = o.id
  left join (
    select
      ts.organization_id,
      count(*) as total,
      count(*) filter (where ts.start_time >= p_today_start and ts.start_time <= p_today_end) as today,
      max(coalesce(ts.start_time, ts.created_at)) as last_activity_at
    from public.training_schedule ts
    where ts.organization_id is not null
    group by 1
  ) l on l.organization_id = o.id
  left join (
    select
      ts.organization_id,
      count(*) as marked_today
    from public.training_participants tp
    join public.training_schedule ts on ts.id = tp.training_id
    where tp.marked_at is not null
      and tp.marked_at >= p_today_start
    group by 1
  ) a on a.organization_id = o.id;
$$;

revoke all on function public.peaker_super_admin_org_summaries(timestamptz, timestamptz) from public;
revoke all on function public.peaker_super_admin_org_summaries(timestamptz, timestamptz) from anon;
revoke all on function public.peaker_super_admin_org_summaries(timestamptz, timestamptz) from authenticated;

comment on function public.peaker_super_admin_org_summaries(timestamptz, timestamptz) is
  'Faz 32 — Super admin paneli: org basina sporcu/koc/ders/yoklama sayimlari (platform taramasi yerine).';
