# Ribi Android App — Setup Guide

## Prerequisites
- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17
- Android SDK 35
- A Firebase project

## Opening in Android Studio
1. Open Android Studio
2. Select **Open** → navigate to the `android/` folder in this project
3. Click **Open**
4. Let Gradle sync complete (first sync downloads dependencies — ~3-5 min)

## Firebase Setup (Required)

### 1. Create Firebase Project
- Go to [Firebase Console](https://console.firebase.google.com)
- Create or select a project

### 2. Add Android App
- Package name: `com.veuros.ribi`
- Download `google-services.json`
- Replace `android/app/google-services.json` with the real file

### 3. Enable Authentication
- Firebase Console → Authentication → Sign-in method
- Enable **Google** sign-in
- Enable **Email/Password** sign-in (for admin access)

### 4. Enable Firestore
- Firebase Console → Firestore Database
- Create database in production mode

### 5. Configure Google Sign-In
- In Firebase Console → Authentication → Settings → Web client ID
- Copy the Web Client ID
- Replace `YOUR_WEB_CLIENT_ID_HERE` in `app/src/main/res/values/strings.xml`

## Building
```bash
# Debug APK
./gradlew assembleDebug

# Release APK (requires keystore setup)
./gradlew assembleRelease

# Install directly to device
./gradlew installDebug
```

## Play Store Deployment
1. Set up a keystore: `keytool -genkey -v -keystore ribi.keystore -alias ribi -keyalg RSA -keysize 2048 -validity 10000`
2. Add signing config to `app/build.gradle.kts`
3. Run `./gradlew bundleRelease` to generate AAB
4. Upload AAB to Google Play Console

## Architecture
```
android/
├── app/
│   └── src/main/java/com/veuros/ribi/
│       ├── RibiApplication.kt        # Hilt app
│       ├── MainActivity.kt           # Entry point
│       ├── data/
│       │   ├── model/Models.kt       # All data models
│       │   ├── local/                # Room DB + DataStore
│       │   └── repository/           # Business logic
│       ├── di/AppModule.kt           # Hilt DI
│       ├── service/MusicService.kt   # Background music
│       └── ui/
│           ├── theme/                # Colors, Typography, Theme
│           ├── navigation/           # Jetpack Navigation
│           ├── splash/SplashScreen   # Animated VEUROS intro
│           ├── auth/                 # Google Sign-In + Admin
│           ├── home/                 # Dashboard + Drawer
│           ├── reader/               # PDF viewer
│           ├── settings/             # Settings panel
│           └── components/           # Shared components
```

## Features Implemented
- [x] Animated VEUROS splash screen (matching web design)
- [x] Google Sign-In authentication
- [x] Secret admin login (tap logo 5 times)
- [x] PDF import from device storage (max 40MB)
- [x] PDF rendering with LRU page cache (8 pages)
- [x] Single page + Continuous scroll modes
- [x] Pinch-to-zoom + zoom controls
- [x] Auto-scroll with adjustable speed
- [x] Reading streak tracking
- [x] 19 page-based achievements
- [x] 8 streak-based achievements
- [x] Achievement toast notifications
- [x] 5 themes: Light, Dark, Sepia, Nord, Midnight
- [x] Auto Night Mode (Midnight after 9PM)
- [x] Brightness control
- [x] PDF render quality (Standard → Ultra)
- [x] Background music (Gamma Waves, Soft Rain, Ocean Tides)
- [x] Volume control
- [x] Bookmarks per book
- [x] Table of Contents
- [x] Firebase Firestore cloud sync
- [x] Offline-first with Room + DataStore
- [x] Cover thumbnail generation
- [x] Reading progress tracking
- [x] Local PDF file storage

## Notes
- PDF files are stored in app's internal storage
- Firestore syncs metadata, settings, and stats (not PDF files)
- The `google-services.json` placeholder must be replaced before building
