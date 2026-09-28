-- ============================================================
-- Sówki PWA v0.5.5.8 — uproszczony formularz wiadomości
-- ============================================================
-- Usuwamy wymóg telefonu/e-maila od rodzica.
-- Zachowujemy starą kolumnę contact dla wcześniejszych wiadomości,
-- ale od teraz może być pusta.

begin;

alter table public.parent_messages
  alter column contact drop not null;

-- Nowa wersja funkcji: bez pola kontaktowego.
create or replace function public.submit_parent_message(
  p_parent_name text,
  p_child_name text,
  p_message text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  p_parent_name := btrim(coalesce(p_parent_name,''));
  p_child_name := btrim(coalesce(p_child_name,''));
  p_message := btrim(coalesce(p_message,''));

  if char_length(p_parent_name) < 2 or char_length(p_parent_name) > 100 then
    raise exception 'Nieprawidłowe imię rodzica.';
  end if;

  if char_length(p_child_name) < 2 or char_length(p_child_name) > 120 then
    raise exception 'Nieprawidłowe imię i nazwisko dziecka.';
  end if;

  if char_length(p_message) < 2 or char_length(p_message) > 1500 then
    raise exception 'Wiadomość ma nieprawidłową długość.';
  end if;

  insert into public.parent_messages(
    parent_name,
    child_name,
    contact,
    message
  )
  values (
    p_parent_name,
    p_child_name,
    null,
    p_message
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.submit_parent_message(text,text,text) from public;
grant execute on function public.submit_parent_message(text,text,text) to anon, authenticated;

commit;
