-- Sówki PWA v0.6.8 — do 4 zdjęć w Ogłoszeniach i Wydarzeniach

begin;

alter table public.events
  add column if not exists image_urls jsonb not null default '[]'::jsonb;

alter table public.announcements
  add column if not exists image_urls jsonb not null default '[]'::jsonb;

-- Zachowujemy dotychczasowe zdjęcia jako pierwszy element tablicy.
update public.events
set image_urls = jsonb_build_array(image_url)
where image_url is not null
  and btrim(image_url) <> ''
  and (image_urls is null or image_urls = '[]'::jsonb);

update public.announcements
set image_urls = jsonb_build_array(image_url)
where image_url is not null
  and btrim(image_url) <> ''
  and (image_urls is null or image_urls = '[]'::jsonb);

commit;
