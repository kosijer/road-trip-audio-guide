# Road Trip Audio Guide / Vodič za put

Android companion app that narrates nearby historical places while you drive or walk. Navigation stays in Google Maps; this app only talks.

Spoken output is currently Serbian. Active development is for general road / city use (not tied to a single trip).

## Prerequisites

- Node 22+
- JDK 17 (`JAVA_HOME` set)
- Android Studio SDK (API 35/36, build-tools, NDK, CMake, platform-tools)
- `.env` with at least `GEMINI_API_KEY` and `GOOGLE_MAPS_API_KEY` (see `.env.example`)

### Optional: Cloudflare Clef (POI ranking)

When enabled, [Clef](https://developers.cloudflare.com/ai/models/@cf/cloudflare/clef/) re-ranks the top nearby places before Gemini writes the spoken script. Without it, the app uses the local keyword heuristic.

```bash
CLEF_ENABLED=true
CLOUDFLARE_ACCOUNT_ID=...   # Cloudflare dashboard Account ID
CLOUDFLARE_API_TOKEN=...    # API token with Workers AI Edit
GEMINI_MODEL=gemini-flash-lite-latest
```

Token: Cloudflare → **My Profile** → **API Tokens** → **Create Token** → **Workers AI:Edit**. Account ID: dashboard search **Copy account ID** (⌘K / Ctrl+K).

Code: [`src/services/decision/clef.ts`](src/services/decision/clef.ts), [`src/services/poi/rankWithDecision.ts`](src/services/poi/rankWithDecision.ts).

## Features (current)

- Driving mode (background trip + periodic nearby narration) and walking “what’s around me”
- Playback: stop, next story, Slow / Normal / Fast speech rate (persisted)
- Debug location presets (London / Westminster / Belgrade) for demos away from real GPS
- Gemini lite models with retry/fallback + local spoken fallback if the LLM is unavailable
- Optional Clef decision ranking before narration
- Weather caveats from Open-Meteo (real GPS even when debug POI location is on)

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

Work happens on `main`. Do not commit `.env`. Document user-facing changes in `CHANGELOG.md` and commit after each sizable change.
