SÓWKI v0.8.27 – OneDrive Upload BETA (GITHUB)
================================================
Kompletna aplikacja na bazie v0.8.26 ECO Live + hiperłącza + statystyki PUSH + Backup Manager.
Nowość: panel prywatnego przesyłania zdjęć na OneDrive w Admin → Galeria.
DODATKOWE WYMAGANIE: najpierw wdróż plik PRIVATNE
  supabase/functions/sowki-onedrive/index.ts
oraz sekret SOWKI_ONEDRIVE_UPLOADER_EMAILS.
Wgraj ZAWARTOŚĆ tego archiwum do głównego katalogu repozytorium GitHub,
a nie samo archiwum ZIP. Zachowaj kopię działającej wersji.
Nie wgrywaj kodu Edge Functions, haseł, SQL ani sekretów na GitHub.

Właściciel + administratorzy wpisani na białą listę w Supabase mogą:
• tworzyć foldery (albumy) w OneDrive/Sówki/01_DO_WERYFIKACJI,
• wybierać do 60 zdjęć JPG/PNG/WebP/HEIC/HEIF, do 45 MB każde,
• przesyłać je sekwencyjnie przez preautoryzowane sesje Microsoft Graph,
• zobaczyć postęp i wynik przesłania.
Brak funkcji usuwania zdjęć i automatycznej publikacji.
Dotychczasowa galeria rodziców nadal wykorzystuje Cloudflare R2.
Po zmianie cache PWA może wymagać ponownego otwarcia aplikacji.

TEST: najpierw JEDNO NIEPRYWATNE zdjęcie z konta właściciela.
Na iOS/Android przetestuj CORS (może blokować bezpośredni transfer w niektórych przeglądarkach).
Jeśli wystąpi błąd, NIE wyłączaj zabezpieczeń i nie wgrywaj zdjęć dzieci do testów.
