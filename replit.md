# Ribi PDF Reader

A beautiful, feature-rich PDF reader web app built with React, Vite, TypeScript, and Tailwind CSS v4. Users can upload PDFs, read them with various themes, bookmark pages, and track reading achievements. Data syncs via Firebase (Firestore + Auth).

## Architecture

- **Frontend**: React 19 + Vite 6 + TypeScript + Tailwind CSS v4
- **Auth & Database**: Firebase (Google Auth, Firestore)
- **Local Storage**: localforage (for storing PDF files in the browser)
- **PDF Rendering**: pdfjs-dist
- **Animations**: Framer Motion (motion/react)
- **Audio**: Howler.js (background music)

## Project Structure

```
src/
  App.tsx              - Main app component with Firebase sync logic
  main.tsx             - Entry point
  index.css            - Global styles + Tailwind
  firebase.ts          - Firebase initialization
  types.ts             - TypeScript types
  constants.ts         - App constants (themes, achievements, tracks)
  utils.ts             - Utility functions
  components/
    AuthScreen.tsx     - Firebase auth UI
    Library.tsx        - Book library panel
    PDFReader.tsx      - PDF viewer component
    PDFPage.tsx        - Individual PDF page renderer
    MusicPlayer.tsx    - Background music controls
    SettingsPanel.tsx  - Reader settings
    SplashScreen.tsx   - App splash screen
    AchievementToast.tsx - Achievement notification
    ErrorBoundary.tsx  - Error boundary wrapper
```

## Key Configuration

- Dev server: `npm run dev` → port 5000, host 0.0.0.0, all hosts allowed
- Firebase config: `firebase-applet-config.json` (already populated)
- Firestore database ID: `ai-studio-d1163401-f328-4333-a4d9-e7b38e7c973a`

## Deployment

Configured as a static site:
- Build: `npm run build` → outputs to `dist/`
- Deployed via Replit static hosting
