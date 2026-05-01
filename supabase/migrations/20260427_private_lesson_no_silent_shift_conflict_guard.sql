create extension if not exists btree_gist;

alter table public.private_lesson_sessions
  drop constraint if exists private_lesson_sessions_no_overlap_planned;

alter table public.private_lesson_sessions
  add constraint private_lesson_sessions_no_overlap_planned
  exclude using gist (
    organization_id with =,
    coach_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status = 'planned');
