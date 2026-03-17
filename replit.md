# Ribi PDF Reader by Veuros

A beautiful, feature-rich PDF reader web app built with React, Vite, TypeScript, and Tailwind CSS v4. Users can upload PDFs, read them with various themes, bookmark pages, and track reading achievements. Data syncs via Firebase (Firestore + Auth).

## Architecture

- **Frontend**: React 19 + Vite 6 + TypeScript + Tailwind CSS v4
- **Auth & Database**: Firebase (Google Auth + Email/Password, Firestore)
- **Local Storage**: localforage (PDF binary files stored in browser)
- **PDF Rendering**: pdfjs-dist with configurable quality (1x-4x DPI)
- **Animations**: Framer Motion (motion/react)
- **Audio**: Howler.js (background music)
- **Fonts**: Orbitron (splash/futuristic), Inter, Crimson Text, JetBrains Mono

## Project Structure

```
src/
  App.tsx              - Main app, Firebase sync, achievement queue, music
  main.tsx             - Entry point
  index.css            - Global styles + Tailwind
  vite-env.d.ts        - Vite env type declarations
  firebase.ts          - Firebase initialization
  types.ts             - TypeScript types (includes renderQuality)
  constants.ts         - App constants (themes, achievements, tracks, MAX_PDF_SIZE_MB=40)
  utils.ts             - Utility functions
  components/
    AuthScreen.tsx     - Google + admin email/password auth (secret: click logo 5x fast)
    Library.tsx        - Book library, PDF upload with auto metadata extraction
    PDFReader.tsx      - PDF viewer with canvas bug fixed, keyboard nav, quality rendering
    PDFPage.tsx        - Virtualized PDF page renderer with LRU cache (max 20 pages)
    MusicPlayer.tsx    - Background music controls
    SettingsPanel.tsx  - Reader settings incl. PDF Quality slider
    SplashScreen.tsx   - Futuristic VEUROS splash with Orbitron font + blue glows
    AchievementToast.tsx - Achievement queue system (shows one at a time)
    ErrorBoundary.tsx  - Error boundary with Firestore error details + try-again
```

## Key Features & Fixes

- **Canvas bug fixed**: Used imperative ref instead of state for canvas, proper cancellation flow
- **Achievement system fixed**: Session-level deduplication, queue-based display (one at a time)
- **Large PDF support**: Up to 40MB, streaming loading, chunked range requests
- **PDF Quality slider**: 1x-4x pixel ratio rendering (Draft → Ultra)
- **Auto metadata extraction**: PDF title extracted from metadata on file select in Library
- **Admin auto-login**: Click Ribi logo 5x fast on auth screen, uses VITE_ADMIN_EMAIL/PASSWORD
- **Error handling**: Full boundary coverage, storage quota detection, corrupted PDF detection
- **Keyboard navigation**: Arrow keys for page turn, F for fullscreen, click page counter to jump
- **LRU page cache**: Keeps 20 pages in memory, evicts oldest for large PDFs
- **Continuous mode debounced**: Page change debounced 100ms to avoid rapid Firestore writes

## Key Configuration

- Dev server: port 5000, host 0.0.0.0, allowedHosts: true
- Firebase config: `firebase-applet-config.json` (pre-configured)
- Admin env vars: `VITE_ADMIN_EMAIL`, `VITE_ADMIN_PASSWORD` (optional, see .env.example)
- Max PDF size: 40 MB (enforced in Library.tsx)

## Deployment

Static site deployment:
- Build: `npm run build` → `dist/`
- Configured as Replit static hosting
