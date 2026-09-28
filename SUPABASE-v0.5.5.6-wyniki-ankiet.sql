-- ============================================================
-- Sówki PWA v0.5.5.6 — zdjęcia wyników zakończonych ankiet
-- ============================================================

begin;

-- Ścieżka do zdjęcia / screena z wynikami ankiety
alter table public.surveys
  add column if not exists results_image_url text;

-- Publiczny odczyt plików z wynikami.
-- Bucket nadal pozostaje prywatny, aplikacja generuje podpisany URL.
drop policy if exists "sowki_public_read_survey_results" on storage.objects;

create policy "sowki_public_read_survey_results"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'sowki-media'
  and name like 'survey-results/%'
);

-- Administrator może dodawać pliki wyników do folderu survey-results.
drop policy if exists "sowki_admin_insert_survey_results" on storage.objects;

create policy "sowki_admin_insert_survey_results"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'sowki-media'
  and name like 'survey-results/%'
  and private.is_sowki_admin()
);

commit;
