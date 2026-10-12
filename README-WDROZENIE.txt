SÓWKI v0.8.28.2 – Galeria 2.0: mozaika, rozmycie, czytelne potwierdzenie
=======================================================================
To aktualizacja WYŁĄCZNIE FRONTENDU (GitHub Pages).
Wymaga wcześniej działającej Galerii 2.0 v0.8.28 oraz prywatnej
funkcji sowki-onedrive v0.8.28.1, którą użytkownik już wdrożył.

CO SIĘ ZMIENIŁO:
* Trzy efekty ukrywania wrażliwych obszarów: mocna mozaika (domyślna),
  mocne rozmycie NA WSTĘPNIE SPISKELIZOWANYM obszarze, czarny prostokąt.
* Obraz podglądu jest redagowany tym samym mechanizmem co zapis JPG.
  Obrysy, numery i etykiety NIE trafiają do zapisanego pliku.
* Czterostopniowy edytor: wskaż twarze → wybierz efekt → potwierdź
  kontrolę wzrokową → zapisz kopię na OneDrive.
* Duża wyraźna karta potwierdzenia z checkboxem po LEWEJ stronie.
  Przycisk zapisu jest nieaktywny do chwili potwierdzenia.
* Ręczny wybór przez przeciągnięcie palcem po zdjęciu, lista masek
  z możliwością usuwania pojedynczego obszaru; łatwe przełączanie trybu.
* Zmiana masek lub efektu resetuje potwierdzenie kontroli wzrokowej.
* Zdjęcia i albumy są nadal przechowywane WYŁĄCZNIE w OneDrive.

WDROŻENIE:
1. Zrób kopię obecnego repozytorium GitHub.
2. Wyślij zawartość paczki GITHUB-AKTUALIZACJA do głównego katalogu
   repozytorium, zastępując 4 pliki i zachowując foldery:
   - index.html
   - sw.js
   - css/style.css
   - js/onedrive-gallery.js
3. Poczekaj na zielony status publikacji GitHub Pages.
4. Odśwież aplikację (na iOS wyjdź z PWA i uruchom ponownie; jeżeli
   wystąpi stary wygląd, odśwież stronę/przeładuj cache aplikacji).
5. Administrator → Galeria → Sprawdź i przygotuj. Na próbę użyj
   neutralnego zdjęcia testowego, a nie wizerunków dzieci.

BRAK ZMIAN w Supabase SQL, funkcjach Edge, OneDrive OAuth, Cloudflare R2,
Backup Manager i istniejącej galerii rodziców.

WAŻNE:
1. To BETA, nie przeprowadzono produkcyjnego testu na OneDrive.
2. Wszystkie twarze i dane wrażliwe trzeba skontrolować ręcznie;
   automatyczny detektor może coś pominąć.
3. Zmiana efektu nie modyfikuje kopii JUŻ zapisanych w 02_ZATWIERDZONE.
   Dla takiego zdjęcia trzeba przygotować nową kopię na bazie oryginału
   i sprawdzić, czy poprzednia wersja nie jest nadal opublikowana.
4. Nie usuwaj działającego kodu sowki-onedrive z Supabase. Nie wrzucaj
   prywatnego kodu i sekretów do repozytorium GitHub.
