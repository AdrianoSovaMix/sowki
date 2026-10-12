SÓWKI v0.8.28 – Gallery 2.0 (GITHUB BETA)

JEST TO WYDANIE TESTOWE. Wdrożenie pełne dopiero po przygotowaniu Supabase.

Do repo GitHub: wgraj ZAWARTOŚĆ tej paczki, zachowując katalogi:
  index.html, js/app.js, js/onedrive-gallery.js, css/style.css, sw.js
  i pozostałe pliki aplikacji.

PRZED wgraniem frontendu:
  - wykonaj SQL 01_GALERIA_ONEDRIVE_2_0.sql z osobnej paczki PRYWATNE;
  - wgraj nową funkcję sowki-onedrive z paczki PRYWATNE;
  - nie wrzucaj prywatnego SQL ani funkcji do publicznego repozytorium.

Nowa sekcja widoczna właścicielowi w Administrator > Galeria:
 - Lista oryginałów z OneDrive > wykrywanie twarzy MediaPipe (opcjonalne);
 - Ręczne zaznaczanie obszarów (rysowanie palcem);
 - Czarna nieprzezroczysta maska; zapis JPG tylko do folderu 02_ZATWIERDZONE;
 - Oddzielny podgląd gotowej kopii i zatwierdzenie publikacji.

Galeria rodziców: po podaniu dotychczasowego hasła pojawiają się osobno
 zatwierdzone albumy z OneDrive, z podglądem i pobieraniem zdjęć.
 Nowe obrazy nie są magazynowane w R2. Stara galeria pozostaje bez zmian.

WERSJA BETA: Zacznij od neutralnego zdjęcia testowego. Automatyczne wykrywanie
 twarzy może pomijać osoby – zawsze sprawdzaj obraz ręcznie.
 Krótkotrwałe URL OneDrive mogą wygasnąć; wtedy ponownie otwórz album.
