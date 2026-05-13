# Faz 9.8 — Materialized View / Aggregation Planı

> Bu turda kod yok. Sadece plan ve karar dayanağı.

## Aday MV'ler

### 1) `daily_training_load_aggregates`

Amaç: Performans dashboard'da takım görünümünde her güne ait toplam yük + sporcu sayısı + ortalama RPE'yi hızlı sorgulamak.

```sql
-- Önerilen şema (henüz uygulanmadı):
create materialized view daily_training_load_aggregates as
select
  organization_id,
  date_trunc('day', measurement_date at time zone 'Europe/Istanbul')::date as day_local,
  count(*) as record_count,
  count(distinct profile_id) as athlete_count,
  sum(total_load) as total_load_sum,
  avg(total_load) as total_load_avg,
  avg(rpe_score) filter (where rpe_score is not null) as rpe_avg
from public.training_loads tl
join public.profiles p on p.id = tl.profile_id
group by 1, 2;

create unique index on daily_training_load_aggregates (organization_id, day_local);
```

Faydası: 500+ sporcu × 50k load → tek SELECT.

### 2) `monthly_finance_summary`

Amaç: Muhasebe dashboard'unda aylık tahsil edilen toplam, vade, kanal dağılımı önceden hesaplanmış.

```sql
-- Önerilen şema:
create materialized view monthly_finance_summary as
select
  organization_id,
  to_char(coalesce(payment_date, due_date), 'YYYY-MM') as month_key,
  count(*) as payment_count,
  sum(case when status = 'odendi' then amount else 0 end) as collected_amount,
  sum(case when status = 'bekliyor' then amount else 0 end) as pending_amount,
  count(*) filter (where status = 'bekliyor' and due_date < current_date) as overdue_count
from public.payments
where deleted_at is null
group by 1, 2;

create unique index on monthly_finance_summary (organization_id, month_key);
```

### 3) `field_test_metric_trends`

Amaç: Sporcu detay sayfasında her metrik için son 90 günün yön ve değişim sinyali (mevcut `summarizeFieldTestSignalsForAthlete` query maliyetini düşürür).

```sql
-- Önerilen şema:
create materialized view field_test_metric_trends as
with windowed as (
  select
    ar.organization_id,
    ar.profile_id,
    ar.metric_id,
    ar.value,
    ar.test_date,
    row_number() over (
      partition by ar.organization_id, ar.profile_id, ar.metric_id
      order by ar.test_date desc
    ) as rn
  from public.athletic_results ar
  where ar.test_date >= current_date - interval '90 days'
)
select
  organization_id,
  profile_id,
  metric_id,
  max(value) filter (where rn = 1) as last_value,
  max(value) filter (where rn = 2) as previous_value,
  max(test_date) as last_test_date
from windowed
group by 1, 2, 3;
```

## Refresh Stratejisi

| MV | Refresh Sıklığı | Trigger | Yöntem |
|----|------------------|---------|--------|
| daily_training_load_aggregates | Günlük 04:00 UTC | pg_cron | `refresh materialized view concurrently daily_training_load_aggregates;` |
| monthly_finance_summary | Saatlik | pg_cron veya post-payment trigger | `refresh materialized view concurrently` |
| field_test_metric_trends | Günlük 04:15 UTC | pg_cron | `refresh materialized view concurrently` |

Trigger-based refresh (write üzerinde) write-amplification yaratır; nightly refresh tercih edilir.

## Riskler

| Risk | Detay | Mitigasyon |
|------|-------|------------|
| Stale data | MV son refresh anına kadar veriyi yansıtmaz | UI'da "Son güncelleme: {ts}" göstergesi; critical action'lar live query |
| Tenant isolation | MV'de organization_id kolonu olmalı, RLS-aware kullanılmalı | View üzerinden değil RPC ile expose et veya RLS policy view'a uygula |
| Storage cost | 3 MV ~10MB / 1000 sporcu | İhmal edilebilir |
| Concurrent refresh | İlk MV oluşturmada unique index gerekli | `concurrently` opsiyonu için unique index zorunlu |

## Faz 10 İçin Karar Noktası

- **Önce ölç:** Production'da gerçek query süresini Sentry/telemetry ile gözlemle.
- **Sonra uygula:** Eğer dashboard query'leri >800ms regularly → MV uygulanır.
- **Migration:** Backward-compatible (eski query'ler MV olmadan da çalışır).

Bu plan Faz 10 backlog'unda. Şu an kod yok.
