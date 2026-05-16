-- Faz 12.1 — Async worker pg_cron tetiklemesi (Vercel Cron alternatifi).
--
-- Hedef:
--   Vercel Cron kullanılamıyorsa veya tüm scheduler'lar tek noktada
--   yönetilmek istenirse, pg_cron her dakikada bir `pg_net.http_post` ile
--   `/api/jobs/process` route handler'ını tetikler.
--
-- Önemli:
--   - Bu migration **opt-in**'dir. Vercel Cron production'da aktif değilse
--     bu cron job migration'ı uygulandığında otomatik etkin olur. Eğer
--     hem Vercel Cron hem pg_cron aktif ise her dakika 2 worker tick
--     çalışır — idempotency garanti ettiği için zararsız ama gereksiz
--     yük. Production'da TEKİ aktif tutulması önerilir.
--   - `pg_net` extension'ı yoksa migration NOTICE üretir ve no-op olur.
--   - Hedef URL ve token Supabase Vault'ta saklanmalıdır:
--       * vault.peaker_worker_url     (https://example.com/api/jobs/process)
--       * vault.peaker_worker_token   (WORKER_SHARED_SECRET ile aynı)
--     Vault yoksa cron job atılmaz.
--
-- Rollback:
--   `20260514_worker_cron_rollback.sql` ile unschedule edilir.

do $$
declare
  has_pg_net boolean := false;
  has_cron boolean := false;
  has_vault boolean := false;
  v_url text;
  v_token text;
begin
  select exists (select 1 from pg_extension where extname = 'pg_net') into has_pg_net;
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  select exists (
    select 1 from information_schema.schemata where schema_name = 'vault'
  ) into has_vault;

  if not has_pg_net then
    raise notice 'pg_net extension yok — worker pg_cron tetiklemesi atlandı.';
    return;
  end if;
  if not has_cron then
    raise notice 'pg_cron extension yok — worker cron tetiklemesi atlandı.';
    return;
  end if;
  if not has_vault then
    raise notice 'vault schema yok — worker URL/token okunamadı; pg_cron tetiklemesi atlandı.';
    return;
  end if;

  -- Vault lookup — tablo yapısı: vault.decrypted_secrets(name text, decrypted_secret text)
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'peaker_worker_url' limit 1;
    select decrypted_secret into v_token
      from vault.decrypted_secrets where name = 'peaker_worker_token' limit 1;
  exception when others then
    raise notice 'vault okunamadı: % — worker cron atlandı.', sqlerrm;
    return;
  end;

  if v_url is null or v_url = '' or v_token is null or v_token = '' then
    raise notice 'vault.peaker_worker_url / vault.peaker_worker_token boş — worker cron atlandı.';
    return;
  end if;

  -- Var olan job'u düşür (idempotent re-run).
  perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'peaker_worker_tick';

  perform cron.schedule(
    'peaker_worker_tick',
    '* * * * *',
    format(
      $cron$
        select net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'X-Worker-Token', %L,
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object('source', 'pg_cron'),
          timeout_milliseconds := 55000
        );
      $cron$,
      v_url,
      v_token
    )
  );
  raise notice 'peaker_worker_tick scheduled (every minute via pg_net)';
end$$;

-- pg_cron Dashboard'dan etkinleştirilmeden bu satır 42704 verir; guard zorunlu.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $cmd$comment on extension pg_cron is
      'Peaker scheduler — retention + MV refresh + worker tick.'$cmd$;
  end if;
end$$;
