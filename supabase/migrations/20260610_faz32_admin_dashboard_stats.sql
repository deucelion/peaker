-- ============================================================================
-- FAZ 32: Admin ana panel istatistikleri icin DB-side agregasyon RPC'si.
--
-- Onceki durum: getDashboardSnapshot admin dali tum org'un payments,
-- training_participants ve profiles+payments(nested) satirlarini cekip
-- bellekte sayiyordu (buyuk org'larda binlerce satir / istek).
--
-- Bu fonksiyon ayni metrikleri tek round-trip'te, satir tasimadan hesaplar.
-- Uygulama RPC bulunamazsa eski sorgulara fallback yapar (schemaCompat).
-- ============================================================================

create or replace function public.peaker_admin_dashboard_stats(p_org_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'attendance_total', (
      select count(*)
      from public.training_participants tp
      join public.training_schedule ts on ts.id = tp.training_id
      where ts.organization_id = p_org_id
    ),
    'attendance_attended', (
      select count(*)
      from public.training_participants tp
      join public.training_schedule ts on ts.id = tp.training_id
      where ts.organization_id = p_org_id
        and tp.attendance_status = 'attended'
    ),
    'payments_total', (
      select count(*)
      from public.payments p
      where p.organization_id = p_org_id
        and p.deleted_at is null
    ),
    'payments_paid_count', (
      select count(*)
      from public.payments p
      where p.organization_id = p_org_id
        and p.status = 'odendi'
        and p.deleted_at is null
    ),
    'payments_paid_sum', (
      select coalesce(sum(p.amount), 0)
      from public.payments p
      where p.organization_id = p_org_id
        and p.status = 'odendi'
        and p.deleted_at is null
    ),
    'team_summaries', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'team_name', t.team_name,
            'total_payments', t.total_payments,
            'paid_payments', t.paid_payments,
            'pending_players', t.pending_players
          )
        ),
        '[]'::jsonb
      )
      from (
        select
          coalesce(nullif(pr.team, ''), 'GENEL') as team_name,
          coalesce(sum(ps.total_cnt), 0) as total_payments,
          coalesce(sum(ps.paid_cnt), 0) as paid_payments,
          count(*) filter (where coalesce(ps.pending_cnt, 0) > 0) as pending_players
        from public.profiles pr
        left join lateral (
          select
            count(*) as total_cnt,
            count(*) filter (where pay.status = 'odendi') as paid_cnt,
            count(*) filter (where pay.status = 'bekliyor') as pending_cnt
          from public.payments pay
          where pay.profile_id = pr.id
            and pay.deleted_at is null
        ) ps on true
        where pr.organization_id = p_org_id
          and pr.role = 'sporcu'
        group by 1
      ) t
    )
  );
$$;

-- Yalnizca service_role cagirabilsin (admin client uzerinden).
revoke all on function public.peaker_admin_dashboard_stats(uuid) from public;
revoke all on function public.peaker_admin_dashboard_stats(uuid) from anon;
revoke all on function public.peaker_admin_dashboard_stats(uuid) from authenticated;

comment on function public.peaker_admin_dashboard_stats(uuid) is
  'Faz 32 — Admin ana panel metrikleri (yoklama orani, tahsilat ozeti, takim odeme ozetleri) tek sorguda.';
