alter table public.training_participants
  add column if not exists attendance_status text not null default 'registered',
  add column if not exists marked_by uuid null references public.profiles(id) on delete set null,
  add column if not exists marked_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'training_participants_attendance_status_check'
  ) then
    alter table public.training_participants
      add constraint training_participants_attendance_status_check
      check (attendance_status in ('registered', 'attended', 'missed', 'cancelled'));
  end if;
end
$$;

update public.training_participants
set attendance_status = case
  when is_present is true then 'attended'
  when is_present is false then 'missed'
  else 'registered'
end
where attendance_status is null
   or attendance_status not in ('registered', 'attended', 'missed', 'cancelled');
