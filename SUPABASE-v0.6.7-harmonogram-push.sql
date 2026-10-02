-- Sówki PWA v0.6.7 — Harmonogram PUSH

begin;

alter table public.notifications
  add column if not exists scheduled_at timestamptz;

alter table public.notifications
  add column if not exists push_sent_at timestamptz;

update public.notifications
set push_sent_at = created_at
where push_sent_at is null
  and scheduled_at is null;

create index if not exists notifications_scheduled_due_idx
on public.notifications (scheduled_at)
where scheduled_at is not null
  and push_sent_at is null;

commit;

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  old_job_id bigint;
begin
  select jobid into old_job_id
  from cron.job
  where jobname='sowki-scheduled-push-hourly'
  limit 1;

  if old_job_id is not null then
    perform cron.unschedule(old_job_id);
  end if;
end
$$;

select cron.schedule(
  'sowki-scheduled-push-hourly',
  '0 * * * *',
  $cron$
    select net.http_post(
      url := 'https://wztxwoernzjjarprrzjl.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-sowki-cron-secret','OM95jzIeESAHLTBs04UjVaqF5lFFLdf9F6Lal4yzkjo'
      ),
      body := '{"mode":"scheduled"}'::jsonb
    )
    where exists (
      select 1
      from public.notifications
      where scheduled_at is not null
        and push_sent_at is null
        and scheduled_at <= now()
    );
  $cron$
);

-- Sprawdzenie:
-- select jobid,jobname,schedule,active from cron.job
-- where jobname='sowki-scheduled-push-hourly';
