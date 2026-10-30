# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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

### Fixed
- Weather caveats: Open-Meteo aligned to the current hour (not midnight), higher rain thresholds, real GPS for weather even with debug POI location, Gemini instructed not to invent rain.
- Gemini abort/timeouts during narration under free-tier load.
