# Vodič za put (Road Trip Audio Guide)

Android companion app that narrates nearby historical places while you drive or walk. Navigation stays in Google Maps; this app only talks.

V1 is a personal build for a Crete trip. UI and spoken output are Serbian.

## Prerequisites

- Node 22+
- JDK 17 (`JAVA_HOME` set)
- Android Studio SDK (API 35/36, build-tools, NDK, CMake, platform-tools)
- `.env` with `GEMINI_API_KEY` and `GOOGLE_MAPS_API_KEY` (see `.env.example`)

## Run

```bash
npm install
npx react-native start
npx react-native run-android
```

Debug APK:

```bash
cd android && ./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

On the phone, install a Serbian voice under **Settings → Accessibility → Text-to-speech** (Google).

## Repo notes

Work happens on `main`. Do not commit `.env`.
