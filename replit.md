# Ribi PDF Reader by Veuros

A beautiful, feature-rich PDF reader built as both a React web app and a native Android app (Kotlin + Jetpack Compose). Users can upload PDFs, read them with various themes, bookmark pages, and track reading achievements. Data syncs via Firebase.

---

## Web App (React)

### Architecture
- **Frontend**: React 19 + Vite 6 + TypeScript + Tailwind CSS v4
- **Auth & Database**: Firebase (Google Auth + Email/Password, Firestore)
- **Local Storage**: localforage (PDF binary files stored in browser)
- **PDF Rendering**: pdfjs-dist with configurable quality (1x-4x DPI)
- **Animations**: Framer Motion (motion/react)
- **Audio**: Howler.js (background music)

### Key Configuration
- Dev server: port 5000, host 0.0.0.0, allowedHosts: true
- Firebase config: `firebase-applet-config.json` (pre-configured)
- Admin env vars: `VITE_ADMIN_EMAIL`, `VITE_ADMIN_PASSWORD` (see .env.example)
- Max PDF size: 40 MB

### Auth Modes
- **Google Sign-In**: full cloud sync via Firestore
- **Guest Mode**: Firebase Anonymous Auth (`signInAnonymously`); all data stays in localforage/React state, Firestore is never touched; a dismissible banner at the top offers to upgrade to Google sign-in; guest books, bookmarks, settings and page progress are fully functional locally
  - Requires "Anonymous" provider enabled in Firebase Console → Authentication → Sign-in methods
- **Admin Mode**: tap logo 5× on AuthScreen → hidden email/password panel (auto-fills from env vars)

---

## Android App (Kotlin + Jetpack Compose)

Located in `android/` directory. Ready to open in Android Studio.

### Architecture
- **Language**: Kotlin 2.0
- **UI**: Jetpack Compose + Material 3
- **DI**: Hilt
- **Local DB**: Room (book metadata)
- **Settings**: DataStore Preferences
- **PDF Rendering**: Android PdfRenderer (built-in, hardware-accelerated)
- **Auth**: Firebase Auth (Google Sign-In via Credential Manager + Email/Password)
- **Cloud Sync**: Firebase Firestore
- **Audio**: MediaPlayer (background music)
- **Navigation**: Jetpack Navigation Compose

### Package Structure
```
android/app/src/main/java/com/veuros/ribi/
├── RibiApplication.kt           - Hilt app entry point
├── MainActivity.kt              - Single activity
├── data/
│   ├── model/Models.kt          - All data classes, enums, constants
│   ├── local/AppDatabase.kt     - Room database
│   ├── local/BookDao.kt         - DAO for book operations
│   ├── local/SettingsDataStore.kt - DataStore for settings/stats
│   └── repository/
│       ├── BookRepository.kt    - PDF import, progress, bookmarks
│       └── SettingsRepository.kt - Settings + Firestore sync
├── di/AppModule.kt              - Hilt DI bindings
├── service/MusicService.kt      - Foreground service for background audio
└── ui/
    ├── theme/                   - Material 3 theme, colors, typography
    ├── navigation/AppNavigation.kt - Nav graph
    ├── splash/SplashScreen.kt   - VEUROS animated splash
    ├── auth/                    - Google Sign-In + admin panel
    ├── home/                    - Dashboard + drawer (library/settings/bookmarks/about)
    ├── reader/                  - PDF viewer (page/continuous, zoom, auto-scroll)
    ├── settings/SettingsPanel.kt - All settings (theme, quality, music, etc.)
    └── components/              - AchievementToast, MusicPlayer
```

### Setup Requirements
1. Replace `android/app/google-services.json` with your Firebase config
2. Enable Google Sign-In + Email/Password in Firebase Auth
3. Enable Firestore database
4. Set `default_web_client_id` in `strings.xml`
5. See `android/SETUP.md` for full instructions

### Features (Android)
- Animated VEUROS splash screen
- Google Sign-In authentication
- Secret admin login (tap logo 5×)
- PDF import (40MB max, title auto-extracted)
- PDF rendering with LRU cache (8 pages)
- Single page + continuous scroll modes
- Swipe gestures for page turning
- Zoom in/out + reset
- Auto-scroll with adjustable speed
- Daily reading streak tracking
- 19 page achievements + 8 streak achievements
- Achievement toast notifications
- 5 themes: Light, Dark, Sepia, Nord, Midnight
- Auto Night Mode (Midnight after 9 PM)
- Brightness + render quality controls
- Background music (Gamma Waves, Soft Rain, Ocean Tides)
- Volume control
- Per-book bookmarks + Table of Contents
- Firebase Firestore cloud sync
- Offline-first with Room + DataStore
- Cover thumbnail generation
