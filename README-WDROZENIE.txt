SÓWKI PWA v0.8.25 ECO Live + Backup Manager
============================================
Pliki w tym archiwum są przeznaczone na GitHub Pages.

Nowa zakładka w panelu administratora: 🛡️ Kopie zapasowe + Kosz.
Wdrożenie WYMAGA dodatkowo prywatnego pakietu Supabase (osobny ZIP).
Przed publikacją należy skonfigurować kopie, harmonogram SQL, hasło
w Supabase Edge Function Secrets i funkcję serwerową sowki-backup.

Dla 300 rodziców: ten moduł nie dodaje cyklicznych żądań do aplikacji
rodziców. Działa w panelu administratora i w zaplanowanych zadaniach SQL.

Ważne: od tej wersji zdjęcia R2 i Supabase Storage nie są fizycznie kasowane
przy usuwaniu wpisów czy podmianie zdjęć — pozwala to odzyskiwać stare
referencje ze snapshotów. To nie jest oddzielna kopia binarna mediów.
Monitoruj zużycie przestrzeni w Cloudflare R2 i Supabase Storage.

Jeżeli panel pokazuje "System kopii nie jest jeszcze gotowy", sprawdź
prywatny plik INSTRUKCJA_WDROZENIA.txt oraz dzienniki funkcji Supabase.
