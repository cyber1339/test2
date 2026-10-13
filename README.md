# REPQUEST — Train. Fight. Evolve.

Aplicație PWA (React + TypeScript + Vite + Tailwind) în care repetările reale, verificate prin cameră cu MediaPipe Pose Landmarker, lovesc monștri. Procesarea e 100% pe telefon; nu se salvează și nu se trimite video. Progresul se salvează local (localStorage).

## Instalare și rulare
```bash
npm install        # descarcă și modelul AI + WASM în public/mediapipe (postinstall)
npm test           # teste pentru logica de numărare, luptă, progres, salvare
npm run dev        # server HTTPS (certificat auto-semnat), accesibil în rețeaua locală
npm run build && npm run preview
```
Dacă `postinstall` nu are internet, aplicația folosește automat CDN-urile MediaPipe la prima pornire.

## Test pe un telefon real
1. Telefonul și calculatorul în aceeași rețea Wi-Fi. Rulează `npm run dev`.
2. Deschide adresa `https://<IP-calculator>:5173` afișată de Vite. Acceptă avertismentul de certificat (e auto-semnat). HTTPS e obligatoriu pentru cameră.
3. Permite accesul la cameră. Pentru flotări: telefon sprijinit pe podea, 1,5–2 m, vedere laterală, tot corpul în cadru.
4. Pentru instalare ca aplicație: iPhone Safari → Distribuie → Adaugă pe ecranul principal; Android Chrome → Instalează aplicația (necesită un host HTTPS real, ex. Netlify/Vercel/Cloudflare Pages după `npm run build`).
5. La calibrare, urmărește indicatorul de detecție. Dacă scade sub ~50%, repoziționează telefonul/lumina.

## Structură
- `src/core/` logica pură, fără UI, testată: `repCounter.ts` (mașina de stări), `framing.ts` (calibrare), `campaign.ts` (monștri, misiuni, luptă), `progression.ts` (XP, nivel, streak, realizări, quest-uri), `plan.ts` (antrenamentul zilei), `storage.ts` (salvare, adaptor înlocuibil cu cloud).
- `src/ai/` pose estimation, cameră, desenarea scheletului.
- `src/screens/`, `src/components/` interfața. `src/i18n/` texte (RO complet, EN parțial cu fallback).

## Praguri de calibrat pe oameni reali
`DEFAULT_TUNING` din `src/core/repCounter.ts` (unghiuri de extensie/coborâre, durata minimă a unei repetări, toleranța corpului). Sunt valori rezonabile, nu validate pe un set de date real.
