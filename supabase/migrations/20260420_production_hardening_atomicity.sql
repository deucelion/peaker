-- Production hardening (P0/P1):
-- - atomic onboarding bundle writes
-- - atomic private lesson usage/payment mutations
-- - atomic package session decrement
-- - monthly payment duplicate guard

-- 1) Monthly payment duplicate cleanup + unique guard
with ranked as (
  select
    id,
    row_number() over (
      partition by organization_id, profile_id, payment_type, due_date
      order by
        case when status = 'odendi' then 0 else 1 end,
        coalesce(payment_date, created_at) desc,
        id desc
    ) as rn
  from public.payments
  where profile_id is not null
    and due_date is not null
)
delete from public.payments p
using ranked r
where p.id = r.id
  and r.rn > 1;

create unique index if not exists uq_payments_org_profile_type_due
  on public.payments (organization_id, profile_id, payment_type, due_date)
  where profile_id is not null and due_date is not null;

-- 2) Atomic onboarding DB writes (auth user creation remains outside DB tx)
create or replace function public.create_athlete_onboarding_bundle(
  p_user_id uuid,
  p_organization_id uuid,
  p_actor_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_team text,
  p_position text,
  p_height numeric,
  p_weight numeric,
  p_onboarding_mode text,
  p_total_lessons integer,
  p_package_total_price numeric,
  p_payment_paid numeric,
  p_payment_date timestamptz,
  p_monthly_amount numeric,
  p_monthly_start_date date,
  p_package_coach_id uuid
)
returns table(package_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_package_id uuid;
  v_amount_paid numeric(12,2);
  v_payment_status text;
  v_month_name text;
  v_year_int integer;
begin
  if p_onboarding_mode not in ('none', 'private_lesson', 'monthly_subscription') then
    raise exception 'Gecersiz onboarding tipi';
  end if;

  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    role,
    position,
    team,
    height,
    weight,
    organization_id,
    is_active,
    created_at,
    next_aidat_due_date,
    next_aidat_amount
  ) values (
    p_user_id,
    p_full_name,
    p_email,
    p_phone,
    'sporcu',
    nullif(trim(coalesce(p_position, '')), ''),
    nullif(trim(coalesce(p_team, '')), ''),
    p_height,
    p_weight,
    p_organization_id,
    true,
    now(),
    case when p_onboarding_mode = 'monthly_subscription' then p_monthly_start_date else null end,
    case when p_onboarding_mode = 'monthly_subscription' then p_monthly_amount else null end
  );

  if p_onboarding_mode = 'private_lesson' then
    if coalesce(p_total_lessons, 0) <= 0 then
      raise exception 'Toplam ders sayisi zorunludur';
    end if;
    if coalesce(p_package_total_price, 0) <= 0 then
      raise exception 'Toplam ucret sifirdan buyuk olmalidir';
    end if;

    v_amount_paid := least(greatest(coalesce(p_payment_paid, 0), 0), p_package_total_price);
    v_payment_status := case
      when v_amount_paid <= 0 then 'unpaid'
      when v_amount_paid >= p_package_total_price then 'paid'
      else 'partial'
    end;

    insert into public.private_lesson_packages (
      organization_id,
      athlete_id,
      coach_id,
      package_type,
      package_name,
      total_lessons,
      used_lessons,
      remaining_lessons,
      total_price,
      amount_paid,
      payment_status,
      is_active,
      created_by
    ) values (
      p_organization_id,
      p_user_id,
      p_package_coach_id,
      'private',
      p_full_name || ' - Özel Ders Paketi',
      p_total_lessons,
      0,
      p_total_lessons,
      p_package_total_price,
      v_amount_paid,
      v_payment_status,
      true,
      p_actor_id
    )
    returning id into v_package_id;

    if coalesce(p_payment_paid, 0) > 0 then
      insert into public.private_lesson_payments (
        package_id,
        organization_id,
        athlete_id,
        coach_id,
        amount,
        paid_at,
        note,
        created_by
      ) values (
        v_package_id,
        p_organization_id,
        p_user_id,
        p_package_coach_id,
        p_payment_paid,
        coalesce(p_payment_date, now()),
        'Onboarding ilk ödeme',
        p_actor_id
      );
    end if;
  end if;

  if p_onboarding_mode = 'monthly_subscription' and coalesce(p_payment_paid, 0) > 0 then
    v_month_name := to_char(coalesce(p_monthly_start_date, current_date), 'TMMonth');
    v_year_int := extract(year from coalesce(p_monthly_start_date, current_date))::int;
    insert into public.payments (
      profile_id,
      organization_id,
      amount,
      payment_type,
      due_date,
      payment_date,
      status,
      month_name,
      year_int,
      description
    ) values (
      p_user_id,
      p_organization_id,
      p_payment_paid,
      'aylik',
      p_monthly_start_date,
      coalesce(p_payment_date, now()),
      'odendi',
      v_month_name,
      v_year_int,
      'Onboarding ilk tahsilat'
    )
    on conflict (organization_id, profile_id, payment_type, due_date)
    do update set
      amount = excluded.amount,
      payment_date = excluded.payment_date,
      status = 'odendi',
      month_name = excluded.month_name,
      year_int = excluded.year_int,
      description = excluded.description;
  end if;

  return query select v_package_id;
end;
$$;

grant execute on function public.create_athlete_onboarding_bundle(
  uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, text, integer, numeric, numeric, timestamptz, numeric, date, uuid
) to authenticated, service_role;

-- 3) Atomic private lesson usage + ledger insert
create or replace function public.private_lesson_apply_usage_atomic(
  p_package_id uuid,
  p_organization_id uuid,
  p_actor_id uuid,
  p_fallback_coach_id uuid,
  p_used_at timestamptz,
  p_note text
)
returns table(next_remaining integer, package_name text, athlete_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg public.private_lesson_packages%rowtype;
  v_next_used integer;
  v_next_remaining integer;
  v_usage_coach_id uuid;
begin
  select *
    into v_pkg
  from public.private_lesson_packages
  where id = p_package_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Paket bulunamadi';
  end if;
  if v_pkg.is_active is not true then
    raise exception 'Pasif paket icin kullanim eklenemez';
  end if;
  if coalesce(v_pkg.remaining_lessons, 0) <= 0 or coalesce(v_pkg.used_lessons, 0) >= coalesce(v_pkg.total_lessons, 0) then
    raise exception 'Paket dersi bitmis; yeni kullanim eklenemez';
  end if;

  v_next_used := v_pkg.used_lessons + 1;
  v_next_remaining := greatest(v_pkg.total_lessons - v_next_used, 0);
  v_usage_coach_id := coalesce(v_pkg.coach_id, p_fallback_coach_id);

  update public.private_lesson_packages
  set
    used_lessons = v_next_used,
    remaining_lessons = v_next_remaining,
    is_active = case when v_next_remaining > 0 then v_pkg.is_active else false end,
    updated_at = now()
  where id = v_pkg.id;

  insert into public.private_lesson_usage (package_id, athlete_id, coach_id, used_at, note)
  values (
    v_pkg.id,
    v_pkg.athlete_id,
    v_usage_coach_id,
    coalesce(p_used_at, now()),
    p_note
  );

  return query
  select v_next_remaining, v_pkg.package_name, v_pkg.athlete_id;
end;
$$;

grant execute on function public.private_lesson_apply_usage_atomic(
  uuid, uuid, uuid, uuid, timestamptz, text
) to authenticated, service_role;

-- 4) Atomic private lesson payment + ledger insert
create or replace function public.private_lesson_apply_payment_atomic(
  p_package_id uuid,
  p_organization_id uuid,
  p_actor_id uuid,
  p_fallback_coach_id uuid,
  p_payment_amount numeric,
  p_paid_at timestamptz,
  p_note text
)
returns table(next_amount_paid numeric, payment_status text, package_name text, athlete_id uuid, total_price numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg public.private_lesson_packages%rowtype;
  v_next_amount_paid numeric(12,2);
  v_next_status text;
  v_payment_coach_id uuid;
begin
  if coalesce(p_payment_amount, 0) <= 0 then
    raise exception 'Tahsilat tutari sifirdan buyuk olmali';
  end if;

  select *
    into v_pkg
  from public.private_lesson_packages
  where id = p_package_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Paket bulunamadi';
  end if;

  v_next_amount_paid := round((coalesce(v_pkg.amount_paid, 0) + p_payment_amount)::numeric, 2);
  v_next_status := case
    when v_next_amount_paid <= 0 then 'unpaid'
    when v_next_amount_paid >= coalesce(v_pkg.total_price, 0) then 'paid'
    else 'partial'
  end;
  v_payment_coach_id := coalesce(v_pkg.coach_id, p_fallback_coach_id);

  update public.private_lesson_packages
  set
    amount_paid = v_next_amount_paid,
    payment_status = v_next_status,
    updated_at = now()
  where id = v_pkg.id;

  insert into public.private_lesson_payments (
    package_id,
    organization_id,
    athlete_id,
    coach_id,
    amount,
    paid_at,
    note,
    created_by
  ) values (
    v_pkg.id,
    p_organization_id,
    v_pkg.athlete_id,
    v_payment_coach_id,
    p_payment_amount,
    coalesce(p_paid_at, now()),
    p_note,
    p_actor_id
  );

  return query
  select v_next_amount_paid, v_next_status, v_pkg.package_name, v_pkg.athlete_id, v_pkg.total_price;
end;
$$;

grant execute on function public.private_lesson_apply_payment_atomic(
  uuid, uuid, uuid, uuid, numeric, timestamptz, text
) to authenticated, service_role;

-- 5) Atomic package session decrement (payments table)
create or replace function public.payments_decrement_package_session_atomic(
  p_payment_id uuid,
  p_organization_id uuid
)
returns table(remaining_sessions integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_type text;
begin
  select payment_type
    into v_payment_type
  from public.payments
  where id = p_payment_id
    and organization_id = p_organization_id;

  if not found then
    raise exception 'Odeme kaydi bulunamadi';
  end if;
  if v_payment_type <> 'paket' then
    raise exception 'Bu islem yalnizca paket odemeleri icindir';
  end if;

  return query
  update public.payments
  set remaining_sessions = remaining_sessions - 1
  where id = p_payment_id
    and organization_id = p_organization_id
    and coalesce(remaining_sessions, 0) > 0
  returning payments.remaining_sessions;
end;
$$;

grant execute on function public.payments_decrement_package_session_atomic(uuid, uuid)
to authenticated, service_role;
