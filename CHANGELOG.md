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
