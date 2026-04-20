-- Özel ders paketine bağlı planlı oturumlar (grup derslerinden bağımsız).
create table if not exists public.private_lesson_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  package_id uuid not null references public.private_lesson_packages(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text null,
  note text null,
  status text not null default 'planned' check (status in ('planned', 'completed', 'cancelled')),
  usage_record_id uuid null unique references public.private_lesson_usage(id) on delete set null,
  completed_at timestamptz null,
  completed_by uuid null references public.profiles(id) on delete set null,
  cancelled_at timestamptz null,
  cancelled_by uuid null references public.profiles(id) on delete set null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_private_lesson_sessions_org_starts
  on public.private_lesson_sessions (organization_id, starts_at desc);

create index if not exists idx_private_lesson_sessions_package_starts
  on public.private_lesson_sessions (package_id, starts_at desc);

create index if not exists idx_private_lesson_sessions_coach_starts
  on public.private_lesson_sessions (coach_id, starts_at desc);

create index if not exists idx_private_lesson_sessions_athlete_starts
  on public.private_lesson_sessions (athlete_id, starts_at desc);

alter table public.private_lesson_sessions enable row level security;

drop policy if exists private_lesson_sessions_select_policy on public.private_lesson_sessions;
create policy private_lesson_sessions_select_policy on public.private_lesson_sessions
for select to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        (me.role = 'admin' and me.organization_id = private_lesson_sessions.organization_id)
        or (
          me.role = 'coach'
          and me.organization_id = private_lesson_sessions.organization_id
          and private_lesson_sessions.coach_id = me.id
        )
        or (me.role = 'sporcu' and me.id = private_lesson_sessions.athlete_id)
      )
  )
);

drop policy if exists private_lesson_sessions_insert_policy on public.private_lesson_sessions;
create policy private_lesson_sessions_insert_policy on public.private_lesson_sessions
for insert to authenticated
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        (me.role = 'admin' and me.organization_id = private_lesson_sessions.organization_id)
        or (me.role = 'coach' and me.organization_id = private_lesson_sessions.organization_id)
      )
  )
);

drop policy if exists private_lesson_sessions_update_policy on public.private_lesson_sessions;
create policy private_lesson_sessions_update_policy on public.private_lesson_sessions
for update to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        (me.role = 'admin' and me.organization_id = private_lesson_sessions.organization_id)
        or (
          me.role = 'coach'
          and me.organization_id = private_lesson_sessions.organization_id
          and private_lesson_sessions.coach_id = me.id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        (me.role = 'admin' and me.organization_id = private_lesson_sessions.organization_id)
        or (
          me.role = 'coach'
          and me.organization_id = private_lesson_sessions.organization_id
          and private_lesson_sessions.coach_id = me.id
        )
      )
  )
);

create or replace function public.private_lesson_sessions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists private_lesson_sessions_set_updated_at on public.private_lesson_sessions;
create trigger private_lesson_sessions_set_updated_at
before update on public.private_lesson_sessions
for each row execute function public.private_lesson_sessions_set_updated_at();

-- Atomik: planned oturumu tamamla, paket sayacını düşür, kullanım kaydı oluştur (çift tamamlamayı engeller).
create or replace function public.complete_private_lesson_session(p_session_id uuid, p_completed_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sess public.private_lesson_sessions%rowtype;
  pkg public.private_lesson_packages%rowtype;
  new_usage_id uuid;
  next_used integer;
  next_rem integer;
  usage_note text;
begin
  select * into sess from public.private_lesson_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Oturum bulunamadı.');
  end if;
  if sess.status <> 'planned' then
    return jsonb_build_object('ok', false, 'error', 'Yalnızca planlanmış oturum tamamlanabilir.');
  end if;
  if sess.usage_record_id is not null then
    return jsonb_build_object('ok', false, 'error', 'Bu oturum zaten işlenmiş.');
  end if;

  select * into pkg from public.private_lesson_packages where id = sess.package_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Paket bulunamadı.');
  end if;
  if not pkg.is_active then
    return jsonb_build_object('ok', false, 'error', 'Pasif paket için oturum tamamlanamaz.');
  end if;
  if pkg.remaining_lessons <= 0 or pkg.used_lessons >= pkg.total_lessons then
    return jsonb_build_object('ok', false, 'error', 'Pakette kullanılacak ders kalmadı.');
  end if;

  next_used := pkg.used_lessons + 1;
  next_rem := pkg.total_lessons - next_used;
  usage_note := 'Özel ders planı (oturum ' || sess.id::text || ')';

  insert into public.private_lesson_usage (package_id, athlete_id, coach_id, used_at, note)
  values (pkg.id, pkg.athlete_id, sess.coach_id, now(), usage_note)
  returning id into new_usage_id;

  update public.private_lesson_packages
  set
    used_lessons = next_used,
    remaining_lessons = next_rem,
    is_active = case when next_rem > 0 then pkg.is_active else false end,
    updated_at = now()
  where id = pkg.id;

  update public.private_lesson_sessions
  set
    status = 'completed',
    completed_at = now(),
    completed_by = p_completed_by,
    usage_record_id = new_usage_id,
    updated_at = now()
  where id = p_session_id and status = 'planned';

  return jsonb_build_object('ok', true, 'usage_id', new_usage_id);
end;
$$;

revoke all on function public.complete_private_lesson_session(uuid, uuid) from public;
grant execute on function public.complete_private_lesson_session(uuid, uuid) to service_role;
