-- FAZ 20 — Supabase Realtime publication (tenant-safe: RLS applies to delivered events).
-- Idempotent:
--   - skip if table not yet created (e.g. FAZ 18 `private_lesson_package_events` not applied);
--   - skip if table already in supabase_realtime.

DO $migration$
DECLARE
  tbl text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication not found; skipping FAZ 20 publication adds';
    RETURN;
  END IF;

  FOREACH tbl IN ARRAY ARRAY[
    'payments',
    'private_lesson_payments',
    'private_lesson_package_events',
    'training_participants'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = tbl
        AND c.relkind = 'r'
    ) THEN
      RAISE NOTICE 'Table public.% does not exist; skipping supabase_realtime add for this name', tbl;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      RAISE NOTICE 'Added table % to supabase_realtime', tbl;
    END IF;
  END LOOP;
END
$migration$;
