# Vodič za put (Road Trip Audio Guide)

Android companion app that narrates nearby historical places while you drive or walk. Navigation stays in Google Maps; this app only talks.

UI and spoken output are Serbian. Active development continues beyond the original Crete trip (general road / city use).

## Prerequisites

- Node 22+
- JDK 17 (`JAVA_HOME` set)
- Android Studio SDK (API 35/36, build-tools, NDK, CMake, platform-tools)
- `.env` with at least `GEMINI_API_KEY` and `GOOGLE_MAPS_API_KEY` (see `.env.example`)

### Optional: Cloudflare Clef (POI ranking)

When enabled, [Clef](https://developers.cloudflare.com/ai/models/@cf/cloudflare/clef/) re-ranks the top nearby places before Gemini writes the spoken script. Without it, the app uses the local keyword heuristic.

In `.env`:

```bash
CLEF_ENABLED=true
CLOUDFLARE_ACCOUNT_ID=...   # Cloudflare dashboard Account ID
CLOUDFLARE_API_TOKEN=...    # API token with Workers AI Edit
```

How to get the token: Cloudflare dashboard → **My Profile** → **API Tokens** → **Create Token** → permission **Workers AI:Edit** (account-scoped). Account ID is on the Workers overview / account home.

Code entry points:

- [`src/services/decision/clef.ts`](src/services/decision/clef.ts) — REST client + types (commented)
- [`src/services/poi/rankWithDecision.ts`](src/services/poi/rankWithDecision.ts) — shortlist → Clef choice → reorder

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
