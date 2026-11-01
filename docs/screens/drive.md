# Drive

**Tab:** Drive  
**Code:** `src/screens/DriveScreen.tsx` → `startTrip` / `drivingTick` → `driveQueue` / `headingCorridor`  
**Moment:** You are moving (car, train, bike with lowered speed threshold).

## Purpose

Hands-light companion: while a trip is active and you are **moving**, Along announces interesting places **ahead on your heading**, with enough lead time to organize a detour — then tells a full story if you don’t Skip.

## Mental model vs Plan / Around

| | Drive | Plan | Around |
|--|-------|------|--------|
| When | During motion | Ahead of time | Right now, stopped or strolling |
| Trigger | Start Trip + speed | User builds loop / A→B | One button |
| Geometry | Forward cones + ETA by speed | Corridor or loop budget | Radius around you |
| Audio | Teaser → hold → full | None (browse / cache) | Immediate full story |

**Plan prefetch is optional.** Drive discovery is live (+ cache). A Plan batch can add candidates when usable, but Drive does not require it and does not follow Plan stop order.

## What the user sees

1. Map  
2. Motion hint (`moving` / `stationary` + km/h)  
3. Mood radios  
4. **Start Trip** / **End Trip**  
5. While teasing: **Coming up** card (title, teaser text, ETA, **Skip**)  
6. After full story: story card (👍/👎, Maps driving directions)

## End-to-end flow

```
Start Trip
  → foreground keep-alive + location ticks (~15 s)
  → while speed ≥ threshold (Settings; default ~25 km/h):
       estimate heading from recent GPS samples
       discover POIs in a large lookahead radius
       filter: not narrated / not already suggested this trip
       narrow forward cone → else wider detour cone
       prefer ETA near speed-scaled lead time (not “already on top of you”)
       hours policy
       preference rank (+ mood)
       TEASER (template TTS, no Gemini)
       HOLD ~10 s (Skip → skipped exposure, no full story)
       FULL → Gemini driving prompt → TTS
       cooldown before next select
```

### Lead time scales with speed

| Speed | Approx. announce lead |
|-------|------------------------|
| ~40–50 km/h (town / demo sim) | ~4–8 minutes ahead |
| ~110 km/h (~70 mph highway) | ~15 / ~22 minutes ahead |

Behind you (outside the forward cone) is not proposed. Already narrated / already teased this trip is excluded.

### Data sources

| Step | Source |
|------|--------|
| Motion / heading | GPS samples (or debug + **Simulate driving motion**) |
| Discover | Wikipedia / OSM / Wikidata (+ optional Plan batch nearby) |
| Hours | Google Places |
| Rank | Preferences + mood; optional Clef on full narration path |
| Teaser | Local i18n template (no LLM) |
| Full story | Gemini driving mode |
| Speak | TTS |

## Teaser template (no LLM)

English-shaped example:

> Coming up in about 15 minutes on your right: Knossos.

Serbian-shaped example:

> Za oko 15 minuta desno: Knossos.

## Example — Highway east, ~113 km/h, mood Nature

**Setup**

- Real drive east on a motorway (or debug pin + simulate motion east @ ~48 km/h for emulator — lead times then follow the *simulated* speed)  
- Mood: **Nature**  
- Threshold: 25 km/h (car)

**Heading:** ~90° (east).  
**Narrow cone:** ±25° ahead. **Wide:** ±60°.  
**Ideal ETA:** ~15 minutes → search out to tens of km, not a fixed 5 km bubble.

**Illustrative candidates in cone**

| Place | ETA | Side | Notes |
|-------|-----|------|-------|
| Scenic overlook A | 14 min | ahead | Strong nature match |
| Medieval castle B | 16 min | right | History-heavy; mood Nature deprioritizes |
| Service plaza C | 8 min | right | Filtered / low interest |

System prefers overlook A (~ideal lead + nature).

**Teaser UI / TTS**

> Coming up in about 14 minutes ahead: Scenic overlook A.

User does nothing for ~10 s → **full narration**.

**Gemini prompt — driving mode snippet**

```
You are a mobile audio travel guide.
Speak to the listener in clear natural English.
Mode: driving — the listener is a car passenger.
Write one narration about a single most interesting place, 30-60 seconds spoken (roughly 80-140 words).
You may say we are driving past / coming up on the place.
Do not tell them to get out and walk unless the place is a clear stop.
Session mood: nature — emphasize landscape, outdoors, parks, views, and atmosphere. …

Source places:
#1 Scenic overlook A
category: viewpoint
distance_m: 26000
summary: …
```

**If user taps Skip during teaser/hold**

- TTS stops  
- Exposure outcome `skipped`  
- No Gemini full story for that slot  
- Short cooldown, then look ahead again  

## Example — Bike

- Settings → trip speed threshold ~8–12 km/h  
- Lead time stays on the “slower” end of the curve (~few minutes), which matches bike decision time  

Walking-around-a-plaza remains **Around**, not Drive.

## Emulator demo

Settings → debug location (e.g. London) → **Simulate driving motion** → Drive → Start Trip.  
App fabricates eastward movement ~48 km/h so `moving` + heading work without a car.

## Slide checklist

- [ ] Start Trip → moving → heading cones  
- [ ] Speed → lead time chart (city vs highway)  
- [ ] Teaser → Skip / silence → full Gemini  
- [ ] Independent of Plan itinerary order  
