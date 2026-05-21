-- FAZ 20 (follow-up) — `private_lesson_package_events` yalnızca FAZ 18 migration'ından sonra var olur.
-- FAZ 20 ana publication migration'ı tablo yoksa bu ismi atlar; bu dosya tablo oluşunca idempotent şekilde ekler.

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication not found; skip';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'private_lesson_package_events'
      AND c.relkind = 'r'
  ) THEN
    RAISE NOTICE 'public.private_lesson_package_events does not exist yet; skip';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'private_lesson_package_events'
  ) THEN
    RAISE NOTICE 'private_lesson_package_events already in supabase_realtime; skip';
    RETURN;
  END IF;

  ALTER PUBLICATION supabase_realtime ADD TABLE public.private_lesson_package_events;
  RAISE NOTICE 'Added private_lesson_package_events to supabase_realtime';
END
$migration$;
