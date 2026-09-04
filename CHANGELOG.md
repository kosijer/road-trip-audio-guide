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
