# Design: Header weather icon + hourly modal

**Status:** Approved for implementation  
**Date:** 2026-11-03  
**App:** Along (road-trip-audio-guide)

## Summary

Add a **weather condition icon** in the main `AppHeader` (immediately left of mute/unmute). Tap opens a small modal with **dominant current conditions** and a **horizontal ~12-hour forecast** (Google Weather–style, no weekly view). Data comes from a single expanded Open-Meteo client fetch, cached and refreshed on a ~45-minute cadence plus any existing `getWeather` call.

## Goals

- At-a-glance weather while planning or traveling (icon in chrome).
- Quick detail on tap: current + next ~12 hours.
- Reuse one Open-Meteo snapshot for UI and existing rain-caveat narration logic.
- Refresh without spamming the API (interval + piggyback on tripEngine calls).

## Non-goals

- Full weekly forecast
- Slingshot workflow / Weather Coach changes (already has its own richer Open-Meteo for LLM narration)
- Feeding slingshot raw hourly into the header cache (optional later)
- Temperature in the navbar
- Weather “suggestions” / indoor tips in the modal
- °F / unit toggle (v1 = °C only)
- Push notifications for rain

## Decisions (from brainstorm)

1. **Approach:** One expanded client `getWeather` snapshot + in-memory cache (not lazy modal-only fetch, not a separate weather-UI service).
2. **Navbar:** Icon only (WMO `weather_code` → Lucide); no temperature in the bar.
3. **Modal content:** Dominant current (large icon + °C + short condition label); below, horizontal scroll of ~12 hourly cells (time, icon, °C, optional precip %).
4. **Horizon:** Next ~12 hours from the current hour (not “until midnight only,” not full week).
5. **Refresh:** ~45 minutes while app is in foreground, plus every successful Open-Meteo call from existing paths; on icon tap, refresh if cache missing/stale.
6. **Location:** Real GPS for weather (same rule as today — debug POI presets must not invent local weather).
7. **Slingshot:** Out of scope for this feature.

## Data & API

### Open-Meteo request (client)

Extend `src/services/weather.ts` from rain-only to:

```
current=temperature_2m,weather_code,precipitation,rain
hourly=temperature_2m,weather_code,precipitation_probability,precipitation
forecast_days=1
timezone=auto
```

### `WeatherSnapshot` (conceptual)

Keep existing rain fields used by narration:

- `rainingNow`, `rainLikelyNextHour`, optional `caveat` (same thresholds as today)

Add UI fields:

- `fetchedAt` (ms)
- `latitude` / `longitude` used for the fetch
- `current`: `{ temperatureC, weatherCode }` — UI maps `weatherCode` → Lucide icon + i18n label key
- `hourly`: array of up to **12** entries from the current hour forward:  
  `{ time, temperatureC, weatherCode, precipProbability }` (`precipProbability` from Open-Meteo; show `%` in each hourly cell)

### Cache & events

- Module-level cache of the latest successful snapshot.
- Emit a device event (same pattern as `MUTE_EVENT`) when the cache updates so `AppHeader` / modal can re-render.
- `getWeather` writes the cache on success; callers (e.g. `tripEngine`) need no UI-specific changes beyond benefiting from the richer response.

### Refresh triggers

| Trigger | Behavior |
|---|---|
| Existing `getWeather` calls | Always update cache when fetch succeeds |
| Foreground interval ~45 min | Fetch using real GPS if available |
| App returns to foreground | If cache older than ~45 min, one refresh |
| Icon tap | If no cache or stale → refresh then show modal; else show modal immediately |
| Background | Pause interval ticks |

## UI

### Header

- `AppHeader` main mode: weather button **left of** mute, then menu.
- Lucide mapping from WMO `weather_code` (sun / cloud / rain / snow / thunder / fog, with sensible buckets).
- No data / error: muted fallback icon (e.g. `Cloud`); tap still attempts refresh.
- Accessibility label: weather / forecast (i18n en + sr).

### Modal

- Same RN `Modal` pattern as `AccountMenu` / `SectionHelp`: transparent backdrop, fade, tap outside to dismiss.
- Layout:
  1. **Current block (dominant):** large condition icon, temperature °C, short condition string.
  2. **Hourly strip:** horizontal `ScrollView`; ~12 cells with hour, small icon, °C, precip %.
- No weekly section, no map, no slingshot suggestion list.
- i18n for condition labels and empty/error copy.

## Error & edge cases

- GPS or network failure: no crash; muted icon; modal shows short “forecast unavailable” message.
- Stale cache + failed refresh: prefer showing last good snapshot over empty. v1 omits an explicit “updated at” line.
- Narration rain caveats unchanged (same precip thresholds); extra fields are additive.
- Debug location presets do not drive weather coordinates.

## Testing

- Update `src/__tests__/weather.test.ts` for new query params and UI fields.
- Keep existing raining / rain-likely caveat assertions green.
- Unit-cover `weather_code` → icon/label mapping for representative codes.
- No requirement for full modal snapshot tests in v1.

## Out of scope follow-ups

- Piggyback header cache from slingshot’s Open-Meteo step without a second client request.
- Add `weather_code` to slingshot hourly if Weather Coach should reason about condition icons.
- °F toggle, severe-weather alerts, multi-day strip.

## Implementation sketch (files)

| Area | Likely touch |
|---|---|
| Open-Meteo + cache + event | `src/services/weather.ts` |
| Code → icon / label | small helper next to weather or under `src/components/` |
| Header button | `src/components/AppHeader.tsx`, `App.tsx` (state / interval / modal visibility) |
| Modal UI | new component e.g. `WeatherModal.tsx` |
| Copy | `src/i18n/en.ts`, `sr.ts`, `types.ts` |
| Tests | `src/__tests__/weather.test.ts` (+ mapping tests if split) |
