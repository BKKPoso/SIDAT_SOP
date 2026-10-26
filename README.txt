SOP SIDAT POSO - FULL FIX

Struktur:
- index.html  -> tampilan
- style.css   -> desain
- app.js      -> frontend + fetch API
- Code.gs     -> API Google Apps Script
- SOP_LOGO.png -> LOGO LOKAL WEBSITE (ganti file ini dengan logo PNG kamu)
- assets/     -> aset tambahan bila diperlukan

PENTING:
1. SOP_LOGO.png berada di project frontend, BUKAN di Google Drive.
2. Code.gs tetap dijalankan/deploy sebagai Web App Apps Script.
3. Frontend dapat dijalankan dari VS Code/local dan nantinya GitHub Pages.
4. Jangan pindahkan SOP_LOGO.png ke Google Drive untuk kebutuhan logo website.
5. URL API saat ini sudah mengikuti URL Web App yang ada di app.js.
6. Jika URL Web App berubah, ubah CONFIG.API_URL di app.js.

Arsitektur:
GitHub Pages / VS Code -> app.js -> fetch(API_URL) -> Code.gs -> Google Drive
Logo: GitHub/local -> SOP_LOGO.png
