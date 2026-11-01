# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Drive v2 coming-up queue: heading cones (narrow then wide), short TTS teaser, silence hold with Skip, then full narration — independent of Plan prefetch (`docs/superpowers/specs/2026-11-01-drive-v2-coming-up-design.md`).
- Personal preferences (spec): taxonomy + mapping classification, Beta learning with decay, bounded Thompson ranking, mute/mood controls, 👍/👎 taste feedback separate from narration stars, Settings taste profile, legacy History rating migration (cautious; non-viable so it does not pollute stats). Reuses AsyncStorage visit history rather than a new SQLite stack.
- Plan tab (Route Prep); Drive simplified to Start Trip + map + next place + Maps directions; configurable trip speed threshold with displacement gate for walk/bike.

### Changed
- App renamed to **Along**; launcher icon is a coral arrow that hints at the letter A on a deep navy field.
- Color system refreshed: navy night road + coral accent + teal highlights (replacing the flat brown palette).

### Added
- React Native 0.87 Android app scaffold (`com.roadtripaudioguide`) with `.env` config via `react-native-dotenv`.
- Location service with Start/End Trip, Android 14 foreground service, GPS reads, and speed-based motion detection.
- POI discovery from Wikipedia GeoSearch, Wikidata enrichment, OSM Overpass, plus local AsyncStorage cache.
- Provider-agnostic narration adapter with Gemini wired by default (Serbian spoken scripts).
- On-device TTS queue (`react-native-tts`).
- Driving and walking flows, including opening-hours (Places) and rain caveats (Open-Meteo).
- Route corridor pre-fetch via Directions API, LLM call cap, and cache-first offline fallback.
- Gradle 9 compatibility patch for `react-native-tts` (replace removed `jcenter()`).
- Debug APK build via `./gradlew assembleDebug` (`android/app/build/outputs/apk/debug/app-debug.apk`).
- Walking mode now uses network location indoors (GPS timeout was showing a false "no network" error), sends a Wikipedia-compliant user agent, and expands the search radius if nothing is found nearby.
- TTS speaking rate raised from 0.42 to 1.0 (normal Android speech speed).
- Playback controls: stop speech, Slow/Normal/Fast rate (persisted), and Next story (another nearby place, not a rewrite of the same one).
- Optional Cloudflare Clef decision ranking: re-orders a heuristic shortlist of nearby POIs before Gemini writes narration (`CLEF_ENABLED` + Cloudflare account token). Falls back to keyword score when disabled or on error.
- Debug location presets (London / Westminster / Belgrade) for demos away from real GPS.
- Local spoken narration fallback when Gemini is unavailable.

### Changed
- Gemini default model is `gemini-flash-lite-latest` with retries across lite fallbacks (`GEMINI_MODEL` in `.env`); avoids frequent 503/timeouts on `gemini-flash-latest`.
- Docs/README no longer frame the app as Crete-trip-only; general road/city companion.
- App UI restructured into Around (default) / Drive / History / Settings tabs; speech rate is a continuous slider (0.50–1.50); English/Serbian UI (default English) with separate narration language that follows UI until overridden.
- Visual polish: clearer type scale, 48dp+ touch targets, Material-ish bottom nav indicator, grouped Settings cards, denser diagnostics, Android ripples — same flows/behavior.
- Around tab map (`react-native-maps` + existing `GOOGLE_MAPS_API_KEY`): shows you, search radius, and last narrated POI marker(s). Requires Maps SDK for Android enabled on the same Google Cloud key (free tier / personal use).

### Added
- History tab: local visit list from narrated places with 1–5 star ratings (AsyncStorage) as a substrate for a future taste profile.
- App header with tab title + Settings affordance; bottom nav is Around / Drive / History with icons (Settings no longer a tab).
- Route Prep preview: map pins + accordion place list; selectable **places to keep** (5 / 12 / 25 / 50). Progress text is “Scanning route”, then top-N pick.
- History accordion rows with rating in the header; visit dedupe by `poiId` or same title within ~200 m (cleans existing duplicates on load).

### Fixed
- Route Prep hanging mid-download (e.g. 4/12) with button stuck on “Downloading…”: per-sample hard timeout, Wikipedia-only corridor fetch (skip flaky Overpass for prefetch), persisted progress, dedicated prefetch busy state.
- Start Trip crash (`TypeError: undefined is not a function`): AsyncStorage v3 removed `multiRemove` — `resetTripMemory` now uses `removeMany`. Foreground keep-alive is also best-effort so a FGS failure cannot abort the trip.
- Weather caveats: Open-Meteo aligned to the current hour (not midnight), higher rain thresholds, real GPS for weather even with debug POI location, Gemini instructed not to invent rain.
- Gemini abort/timeouts during narration under free-tier load.
