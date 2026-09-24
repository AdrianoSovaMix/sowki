-- Sówki PWA v0.5.3.1
-- Jednorazowa migracja: ręczna kolejność treści we wszystkich działach.
-- Uruchom w Supabase -> SQL Editor PRZED wdrożeniem aplikacji v0.5.3.1.

begin;

alter table public.monthly_notices add column if not exists sort_order integer;
alter table public.announcements add column if not exists sort_order integer;
alter table public.events add column if not exists sort_order integer;
alter table public.menus add column if not exists sort_order integer;
alter table public.surveys add column if not exists sort_order integer;
alter table public.gallery_albums add column if not exists sort_order integer;
alter table public.notifications add column if not exists sort_order integer;

-- Ważne: zachowujemy dotychczasową kolejność, uwzględniając istniejący sort_order.
with ranked as (
  select id,
         row_number() over (
           order by sort_order asc nulls last,
                    event_date desc nulls last,
                    id desc
         ) * 10 as new_order
  from public.monthly_notices
)
update public.monthly_notices t
set sort_order = r.new_order
from ranked r
where t.id = r.id;

-- Ogłoszenia: dotychczas najnowsza data była pierwsza.
with ranked as (
  select id,
         row_number() over (
           order by event_date desc nulls last, id desc
         ) * 10 as new_order
  from public.announcements
)
update public.announcements t
set sort_order = r.new_order
from ranked r
where t.id = r.id;

-- Wydarzenia: dotychczas najnowsze wydarzenie było pierwsze.
with ranked as (
  select id,
         row_number() over (
           order by event_date desc nulls last, id desc
         ) * 10 as new_order
  from public.events
)
update public.events t
set sort_order = r.new_order
from ranked r
where t.id = r.id;

-- Jadłospis: dotychczas najnowszy zakres dat był pierwszy.
with ranked as (
  select id,
         row_number() over (
           order by date_from desc nulls last, id desc
         ) * 10 as new_order
  from public.menus
)
update public.menus t
set sort_order = r.new_order
from ranked r
where t.id = r.id;

-- Ankiety: zachowujemy dotychczasowe sortowanie po terminie końcowym.
with ranked as (
  select id,
         row_number() over (
           order by ends_at asc nulls last, id desc
         ) * 10 as new_order
  from public.surveys
)
update public.surveys t
set sort_order = r.new_order
from ranked r
where t.id = r.id;

-- Galeria: dotychczas najnowszy album był pierwszy.
with ranked as (
  select id,
         row_number() over (
           order by event_date desc nulls last, id desc
         ) * 10 as new_order
  from public.gallery_albums
)
update public.gallery_albums t
set sort_order = r.new_order
from ranked r
where t.id = r.id;

-- Powiadomienia: dotychczas najnowsze było pierwsze.
with ranked as (
  select id,
         row_number() over (
           order by created_at desc nulls last, id desc
         ) * 10 as new_order
  from public.notifications
)
update public.notifications t
set sort_order = r.new_order
from ranked r
where t.id = r.id;

create index if not exists monthly_notices_sort_order_idx on public.monthly_notices(sort_order);
create index if not exists announcements_sort_order_idx on public.announcements(sort_order);
create index if not exists events_sort_order_idx on public.events(sort_order);
create index if not exists menus_sort_order_idx on public.menus(sort_order);
create index if not exists surveys_sort_order_idx on public.surveys(sort_order);
create index if not exists gallery_albums_sort_order_idx on public.gallery_albums(sort_order);
create index if not exists notifications_sort_order_idx on public.notifications(sort_order);

commit;
