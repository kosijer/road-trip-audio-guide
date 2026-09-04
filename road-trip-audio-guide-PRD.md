# PRD: Road Trip Audio Guide (V1)

## 1. Overview

A React Native (Android-first) app that acts as an "ambient companion" during driving and walking, providing spoken narration about points of interest (POIs) near the user's current location — historical facts, monuments, notable birthplaces, battle sites, etc. — without requiring the user to touch their phone. It runs alongside the user's normal navigation app (e.g. Google Maps); it does not replace navigation.

**Primary use case for V1:** the developer's own personal use during a road trip in Crete, starting in 5 days. The app must be usable "out of the box" with minimal manual tuning.

**This document is written to be handed directly to an AI coding agent, which is expected to work through it end-to-end with minimal supervision and produce an installable APK. See Section 12 for the exact execution plan.**

## 2. Problem Statement

While driving through unfamiliar areas, the user often passes interesting places (historic towns, monuments, landmarks) without knowing anything about them, because checking a phone while driving is unsafe/illegal. Sometimes the user only realizes afterward that a small detour would have been worthwhile. The same problem exists in a lighter form while walking around a new place.

## 3. Prerequisites — Read Before Starting the Agent

These need to be prepared by the user *before* kicking off the AI agent, since the agent should not need to stop and wait for credentials mid-run.

### 3.1 Accounts & API Keys

| What | Needed for | Notes |
|---|---|---|
| LLM provider API key (Anthropic, OpenAI, **or** Google Gemini) | Narration generation (6.4) | Only one is required for V1 since the app uses a provider-agnostic adapter. Anthropic and OpenAI have no ongoing free tier (a small one-time trial credit only, then a card is required) but are cheap enough per request for personal use. **Google Gemini (aistudio.google.com) has a genuinely free tier with no card required** — a good $0 default while testing, swappable later via the adapter. |
| Google Cloud project + API key with **Places API** enabled | Opening-hours lookups (6.5, walking mode) | Requires a billing account (card) attached to the Google Cloud project to generate the key at all. As of March 2025 the old universal $200/month credit was replaced by a per-API monthly free-usage threshold (typically a few thousand calls/month) — personal-use volume should stay within it, but a card is still mandatory upfront. |
| Google Cloud **Directions API** enabled on the same key | Route-based pre-fetch (6.3) | Only needed if you plan to input a planned route before a trip; the live-query fallback works without it. Recommended to enable anyway since it's on the same project/key. |
| GitHub repository (already created by user, `main` branch, empty or README-only) | Source control (6.9) | Clone it locally with authentication already working (SSH key or PAT) so the agent's `git push` commands don't hit an interactive login prompt. |

No key needed for: Wikipedia/Wikidata, OpenStreetMap Overpass API, Open-Meteo (weather).

### 3.2 Software (in addition to your IDE and Node.js, which you already have)

- **Android Studio** — provides the Android SDK, platform-tools, build-tools, and an emulator. Required to produce the final APK via Gradle, even though you're not writing code in Android Studio itself.
- **JDK 17** (verify against the React Native version's requirement at project init; usually bundled with Android Studio — confirm `JAVA_HOME` is set correctly).
- `ANDROID_HOME` / `ANDROID_SDK_ROOT` environment variables set, with an Android platform + build-tools version installed matching the project's target SDK.
- **Git**, configured (`git config --global user.name` / `user.email`) with GitHub authentication already working.
- A **physical Android device** with USB debugging enabled (strongly recommended) — GPS/location behavior is hard to meaningfully test on an emulator. An emulator can be used for basic UI/build sanity checks only.
- **Watchman** (optional, recommended for React Native on macOS/Linux).

## 4. Goals (V1)

- Provide automatic, periodic spoken narration about nearby POIs while driving, without requiring manual interaction.
- Provide an on-demand "what's around me" spoken summary while walking, triggered by a single button press.
- Work reliably enough for a real vacation trip (Crete) including areas with patchy mobile connectivity.
- Be cheap/free to run for a single user (BYO API key model, no backend).
- Be buildable end-to-end by an AI coding agent from this document, resulting in an installable APK, with minimal input from the user beyond the prerequisites above.

## 5. Non-Goals (V1)

- No turn-by-turn navigation (user keeps using Google Maps/Waze separately).
- No iOS support (Android only for V1).
- No Android Auto integration.
- No user preference system (e.g. "prefer history over market towns").
- No multi-language UI (Serbian only, hardcoded).
- No in-app API key entry UI, no monetization, no trial system — API key(s) are supplied via local config/env for V1.
- No voice command interaction (e.g. "tell me more") — one-way narration only.
- No off-route "you just passed X" detection — only proximity-based triggers on current position.

These are explicitly deferred to future phases (see Section 10).

## 6. User Modes

### 6.1 Driving Mode

- User taps "Start Trip" before departing.
- App tracks location in the background while the trip is active (via a foreground service with a persistent notification — required by Android for background location, and a natural fit for an explicit "trip active" state).
- App detects motion state (moving vs stationary) using GPS speed (threshold ~25 km/h sustained) to avoid triggering narration while parked or in a city traffic jam.
- Every N minutes (configurable, default 3 min) while moving, or when entering a new "cell" of the pre-fetched corridor (see 7.3), the app checks for nearby POIs not yet narrated.
- If a suitably interesting POI is found, the app generates and plays a ~30-60 second spoken narration in Serbian.
- User taps "End Trip" to stop background tracking.

### 6.2 Walking Mode

- Single button: "What's around me?"
- On tap, app takes current GPS position, queries POI sources within a smaller radius (default 800m), and returns a short spoken summary of the most interesting nearby POI(s) (1-3).
- Filters applied before narration:
  - **Opening hours**: if a POI has known opening hours and is currently closed, either skip it or mention it's closed, depending on relevance (see 7.5). Never recommend visiting a closed venue as if it were open.
  - **Weather**: if current conditions or the next-hour forecast show significant precipitation (see 7.6 for threshold), outdoor-only POIs (e.g. viewpoints, ruins, walking trails) should be flagged with a caveat ("it's currently raining, so...") rather than silently recommended.
- No background tracking required for this mode — it's a one-shot, on-demand query.

## 7. Functional Requirements & Technical Architecture

### 7.1 High-Level Architecture

Keep a clear separation between:

1. **Location Service** — background tracking (driving mode) and one-shot location fetch (walking mode).
2. **POI Discovery Service** — given a location (or route corridor) and radius, returns candidate POIs from external sources.
3. **Narration Engine** — given raw POI data, selects the best candidate(s) and produces a short spoken-language script via an LLM.
4. **TTS Service** — converts narration text to speech and plays it.
5. **Cache/Store** — persists fetched POI data and generated narrations locally to reduce API calls and support offline resilience.

This separation matters even for V1: it keeps the door open for a future Android Auto media-service layer or a walking-mode UI without touching the core logic.

### 7.2 Location Tracking (Driving Mode)

- Use a **free** approach for V1 (no paid plugin license required, to avoid a purchase blocking the build before the trip): a foreground service (e.g. via `react-native-background-actions` or equivalent) keeping a persistent "Trip active" notification, combined with a GPS read library (e.g. `react-native-geolocation-service`) for periodic position updates.
- Explicit "Start Trip" / "End Trip" toggle — no always-on background tracking in V1.
- Motion detection: GPS speed > ~25 km/h sustained for driving-mode triggers; below that, pause active polling.

### 7.3 POI Discovery & Pre-Fetching

**Data sources (in order of use):**
- **Wikipedia GeoSearch API** — primary source for historical facts, notable people, events. Query in English for best coverage.
- **Wikidata (SPARQL)** — structured facts (birthplace, construction date, event type) to enrich Wikipedia results when available.
- **OpenStreetMap / Overpass API** — monuments, historic sites, viewpoints, and other `historic=*`/`tourism=*` tagged features not covered by Wikipedia.
- **Google Places API** — used specifically for `opening_hours` data on named venues (museums, sites) where available; not the primary discovery source (cost).

**Pre-fetch flow (important for Crete — patchy connectivity):**
- Before or at the start of a trip (while the user still has connectivity, e.g. at the hotel on wifi), the app should allow fetching POIs along the planned route corridor in advance and caching them locally.
- Corridor sampling: sample points along the route polyline (from Google Directions API) every ~5-10 km, query each source with a radius buffer (~5 km) around each sample point, and de-duplicate results.
- If no route is provided (e.g. spontaneous driving without a planned destination), fall back to periodic live queries around the current position, with graceful skipping if there's no connectivity at that moment (see 7.7).

### 7.4 Narration Engine (LLM Integration)

- **Provider-agnostic design**: implement an adapter/interface (e.g. `LLMProvider.generateNarration(poiData): Promise<string>`) so the underlying LLM API (Anthropic, OpenAI, etc.) can be swapped via config without touching calling code. Wire up one provider by default for V1, chosen based on whichever API key is supplied.
- API key(s) supplied via local `.env` / build config for V1 — no in-app key management UI. Never commit real key values; commit a `.env.example` with placeholder names instead.
- Input to the LLM: raw POI data (title, summary/extract, coordinates, any Wikidata facts, category).
- Output: a short (~30-60 second spoken length) narration script in **Serbian**, written for natural spoken delivery, regardless of the source data's original language.
- Selection logic: when multiple POIs are candidates, prefer the single most interesting one per trigger interval, using simple heuristics (e.g. article length, presence of notable facts/categories like "battle", "birthplace", "castle") — no separate scoring model in V1, this can be folded into the same LLM call (ask it to pick and narrate in one step) or done with a lightweight heuristic before calling the LLM. Either is acceptable; prefer whichever is most reliable to implement.

### 7.5 Opening Hours Handling (Walking Mode)

- Attempt to resolve opening hours via Google Places Details API for named venues.
- If hours are available: check against current local time; if closed, either exclude the POI from recommendations or include it with an explicit "currently closed" caveat, depending on whether it's still worth mentioning (e.g. a landmark viewable from outside vs. a museum you can't enter).
- If hours are unavailable: proceed without mentioning hours at all — do not block or warn based on missing data.

### 7.6 Weather Handling (Walking Mode)

- Source: **Open-Meteo API** (free, no API key required) — current conditions + hourly forecast.
- Before recommending an outdoor-only POI, check current precipitation and the forecast for roughly the next hour.
- Threshold: if precipitation is currently occurring, or forecast probability for the next hour is high, add a spoken caveat rather than silently recommending outdoor activity (exact wording/threshold left to implementation — no config UI needed in V1).

### 7.7 Offline Resilience & Cost Guardrails

- If a live POI query fails due to no connectivity, skip silently (no narration for that interval) rather than retrying aggressively or showing an error.
- Rely on pre-fetched/cached data (7.3) as the primary defense against connectivity gaps.
- Add a simple hard cap on LLM calls per trip (configurable, e.g. a max count) to avoid runaway API costs from an unexpectedly long or POI-dense trip.
- Cache generated narrations locally so the same POI isn't re-narrated (and re-billed) if passed again in the same trip.

### 7.8 TTS

- On-device TTS (`react-native-tts` or platform default) for V1 — no cloud TTS service needed initially.
- Narration should play automatically when generated; if another narration is still playing, queue rather than overlap or interrupt.

### 7.9 Git & Changelog Workflow (Required)

- The GitHub repo is pre-created by the user with `main` as the default branch, already cloned locally with working authentication, before the agent starts.
- Work directly on `main` — no feature branches, no pull requests.
- After completing each meaningful unit of work (roughly one per module/feature — see the phases in Section 12), the agent must:
  1. Stage and commit changes with a clear, conventional-style commit message (e.g. `feat: add background location service`).
  2. Add a corresponding entry to `CHANGELOG.md` under an `[Unreleased]` section (Keep a Changelog format), describing what was added or changed.
  3. Push directly to `origin main`.
- Commits should be reasonably granular, not one giant commit at the end.

## 8. Data Flow Summary

**Driving Mode:**
`Start Trip → (optional) pre-fetch POIs along route → background location updates → motion check → periodic/corridor-cell trigger → POI Discovery (cache-first, then live) → Narration Engine (LLM) → TTS playback → mark POI as narrated → repeat until End Trip`

**Walking Mode:**
`Button tap → get current location → POI Discovery (small radius) → filter by opening hours + weather → Narration Engine (LLM) → TTS playback`

## 9. Success Criteria (for the Crete trip test)

- App can run a full driving session (start to end of a multi-hour drive) without crashing or requiring manual restarts.
- At least some narrations are triggered automatically during real driving without any interaction beyond "Start Trip".
- Walking-mode button produces a relevant, spoken result within a few seconds of tapping.
- No outdoor POI is recommended during active rain without a caveat.
- No closed venue is recommended as visitable without a caveat (when hours data is available).
- App degrades gracefully (no crash, no hang) when connectivity drops mid-drive.
- A working APK is produced and installable on a real device via sideloading.

## 10. Future Phases (explicitly out of scope for V1)

- iOS support.
- Android Auto integration via Media Browser Service template (audio-content-style integration, not full navigation UI).
- User preference profiles (e.g. history vs. nature vs. market towns).
- In-app API key entry, free/paid tiers, trial system.
- Off-route discovery ("you just passed X, detour would take Y minutes").
- Voice command interaction ("tell me more", "skip").
- Multi-language UI/narration toggle (Serbian/English).
- Scenic vs. fastest route mode selection / route-injection logic.
- Smarter interestingness scoring (e.g. based on Wikipedia pageviews or a dedicated scoring model).
- Switching to a more robust paid background-location plugin if the free approach proves unreliable in real-world testing.

## 11. Open Assumptions

- Narration language is Serbian only, hardcoded (per decision).
- LLM provider is abstracted behind an adapter interface so it can be swapped later, but only one provider needs to be wired up for V1.
- Both driving and walking modes are in scope for the initial build, to be tested together during the Crete trip.
- Both a route-based pre-fetch flow and a route-less live-query fallback should be supported, since actual usage in Crete may include both planned drives and spontaneous ones.
- The free/foreground-service location approach (7.2) is acceptable for V1 in exchange for avoiding a paid plugin license before the trip.

## 12. AI Agent Execution Plan

Work through these phases in order. After each phase, follow the Git & Changelog Workflow in 7.9 before moving to the next phase.

1. Clone the pre-created GitHub repo (already has a `main` branch). Confirm it's empty or contains only a README.
2. Initialize a React Native (bare workflow) project inside the repo, Android target only for V1 (iOS project files can be left untouched/ignored).
3. Set up `.env`-based config handling for the LLM API key and Google API key (read from environment or a git-ignored local config file). Commit a `.env.example` with placeholder names — never commit real key values.
4. Implement the Location Service (7.2): Start/End Trip toggle, foreground service, GPS updates, motion detection.
5. Implement the POI Discovery Service (7.3): Wikipedia GeoSearch, Wikidata enrichment, OSM Overpass queries, local caching layer.
6. Implement the Narration Engine (7.4): provider-agnostic LLM adapter, one provider wired by default, Serbian narration output.
7. Implement the TTS Service (7.8).
8. Implement the Driving Mode flow (6.1): UI for Start/End Trip, wiring 4–7 together into the periodic trigger loop.
9. Implement the Walking Mode flow (6.2): "What's around me?" button, opening-hours check (7.5), weather check (7.6), wiring into 5–7.
10. Implement the pre-fetch flow (7.3) and offline/cost guardrails (7.7).
11. Do a smoke-test pass. Since GPS/location behavior can't be fully verified without a real device, the agent should clearly state what it could and couldn't verify itself, and what the user should manually check on-device.
12. Build a debug APK via Gradle (`./gradlew assembleDebug` is sufficient for personal sideloading — no signed release build needed unless requested). Confirm the `.apk` file exists under `android/app/build/outputs/apk/...` and report its exact path.
13. Final commit and changelog entry marking V1 complete, pushed to `main`.
