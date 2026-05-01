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
    id, full_name, email, phone, role, position, team, height, weight, organization_id, is_active, created_at, next_aidat_due_date, next_aidat_amount
  ) values (
    p_user_id, p_full_name, p_email, p_phone, 'sporcu',
    nullif(trim(coalesce(p_position, '')), ''),
    nullif(trim(coalesce(p_team, '')), ''),
    p_height, p_weight, p_organization_id, true, now(),
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
      organization_id, athlete_id, coach_id, package_type, package_name, total_lessons, used_lessons, remaining_lessons, total_price, amount_paid, payment_status, is_active, created_by
    ) values (
      p_organization_id, p_user_id, p_package_coach_id, 'private', p_full_name || ' - Özel Ders Paketi',
      p_total_lessons, 0, p_total_lessons, p_package_total_price, v_amount_paid, v_payment_status, true, p_actor_id
    )
    returning id into v_package_id;

    if coalesce(p_payment_paid, 0) > 0 then
      insert into public.private_lesson_payments (
        package_id, organization_id, athlete_id, coach_id, amount, paid_at, note, created_by
      ) values (
        v_package_id, p_organization_id, p_user_id, p_package_coach_id, p_payment_paid, coalesce(p_payment_date, now()), 'Onboarding ilk ödeme', p_actor_id
      );
    end if;
  end if;

  if p_onboarding_mode = 'monthly_subscription' and coalesce(p_payment_paid, 0) > 0 then
    v_month_name := to_char(coalesce(p_monthly_start_date, current_date), 'TMMonth');
    v_year_int := extract(year from coalesce(p_monthly_start_date, current_date))::int;
    insert into public.payments (
      profile_id, organization_id, amount, payment_type, due_date, payment_date, status, month_name, year_int, description
    ) values (
      p_user_id, p_organization_id, p_payment_paid, 'aylik', p_monthly_start_date, coalesce(p_payment_date, now()), 'odendi',
      v_month_name, v_year_int, 'Onboarding ilk tahsilat'
    )
    on conflict (organization_id, profile_id, payment_type, due_date)
    where profile_id is not null and due_date is not null
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
