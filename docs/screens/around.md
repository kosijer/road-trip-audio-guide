# Around

**Tab:** Around (default)  
**Code:** `src/screens/AroundScreen.tsx` → `walkingNow()` / `suggestNearbyPlaces()`  
**Moment:** You are somewhere *now* (plaza, unknown city, hotel walk).

## Purpose

One-tap spoken answer: **what’s interesting near me?** Secondary: list more places without speaking all of them.

## What the user sees

1. Map (you + search radius + markers after a result)
2. Session mood radios: History / Nature / Surprise
3. Primary button: **Around me**
4. After a successful Around me only:
   - Story card (title, narration, 👍/👎, optional narration stars, Maps walking directions)
   - **More nearby** → up to 5 accordion rows (no auto-TTS)

## End-to-end flow (Around me)

```
Tap Around me
  → permission + GPS (or Settings debug pin)
  → Discover POIs (~800 m; expand to ~3 km if empty)
  → Drop recently narrated
  → Heuristic rank (interestingness + distance)
  → Open-Meteo weather caveat (real GPS even if debug POI pin is on)
  → Google Places hours on top candidates; drop closed indoor where policy says so
  → Optional Clef: pick best of shortlist
  → Gemini walking prompt → script
  → TTS speaks
  → Save visit + preference exposure
  → Unlock story card + More nearby
```

### Data sources (APIs)

| Step | Source | Notes |
|------|--------|-------|
| Discover | Wikipedia GeoSearch, OSM Overpass, Wikidata enrich | Cached locally when possible |
| Weather | Open-Meteo | Free; rain → caveat string |
| Hours | Google Places Details | Only for named venues; missing hours ≠ closed |
| Decide (optional) | Cloudflare Clef | Not narration — ranking only |
| Narrate | Gemini (`gemini-flash-lite-…`) | Cached per POI set |
| Speak | On-device TTS | Rate / mute in Settings |

**Google Maps** here is mainly the **map tile UI** (Maps SDK). Directions open via a Maps URL with `travelmode=walking`.

## Ranking notes

- Primary Around me path: **heuristic `rankPois` + optional Clef**, then Gemini.
- Session **mood** influences Clef instructions and the Gemini prompt tone.
- Full preference `rankCandidates` (learned taste) is used heavily on **More nearby**, not as the core of the first Around me pick.

## Example A — Westminster, mood = History

**Setup**

- Debug location: Westminster  
- Mood: **History**  
- Narration language: English  
- Weather: dry  
- Clef: enabled  

**Discovery (illustrative shortlist)**

| # | Place | ~distance | Why it surfaced |
|---|--------|-----------|-----------------|
| 1 | Westminster Abbey | 180 m | Wikipedia historic landmark |
| 2 | Palace of Westminster | 250 m | Parliament / UNESCO-style coverage |
| 3 | Churchill War Rooms | 420 m | WW2 museum (hours may apply) |

Hours check might keep Abbey + Palace and flag War Rooms if closed.

**Clef (decision) question — shape**

```
The listener is on foot (Around / walking).
Which place should the audio travel guide narrate next?
Strongly prefer historically notable sites (castles, monuments, wartime, famous people)
over generic amenities.

p0: Westminster Abbey (historic, 180m). …
p1: Palace of Westminster (historic, 250m). …
p2: Churchill War Rooms (museum, 420m). …
```

Clef returns e.g. `p0` (Abbey) with highest probability → that POI is selected for narration (one focal place).

**Gemini prompt — concrete example**

```
You are a mobile audio travel guide.
Speak to the listener in clear natural English.
Mode: walking — the listener is on foot exploring nearby (Around mode).
Write one narration covering the 1-3 most interesting nearby places, 30-60 seconds spoken.
Speak as a walking guide: "as you walk", "nearby", "from here", "on foot".
Never mention driving, cars, passengers, "drive by", "driving past", or "from the road".
Session mood: history — lean into historical context, eras, and notable events.
No markdown, no bullet points, no title.
If a place is closed, say so clearly and do not recommend going inside.
Only mention rain or weather if Additional context explicitly says so. …
Do not invent precise dates or facts that are not in the source text.

Source places:
#1 Westminster Abbey
category: historic
distance_m: 180
facts: inception: 960, …
summary: Westminster Abbey is a large, mainly Gothic abbey church…
```

**Example spoken output (illustrative)**

> As you walk from here, Westminster Abbey sits almost beside you — a Gothic landmark where coronations have been held for centuries. Nearby, the Palace of Westminster marks the seat of Parliament. From here on foot you can take both in within a few minutes if you keep along the river side of the precinct.

**UI after**

- Map pin on Abbey (focal)
- Story card with text + 👍/👎 + “Open in Maps” (walking directions)
- **More nearby** appears

## Example B — More nearby after Example A

User taps **More nearby**.

- Re-discover / reuse cache around the same point  
- Exclude Abbey (just narrated)  
- Rank with **preferences + mood** (`rankCandidates`, mode browse-like)  
- Show up to 5 cards: title, distance, category, Maps, 👍/👎 — **no TTS for the whole list**

Illustrative list:

1. Palace of Westminster — 250 m  
2. Churchill War Rooms — 420 m  
3. St Margaret’s Church — 200 m  
4. Jewel Tower — 350 m  
5. Parliament Square — 300 m  

## Example C — Rain

Open-Meteo reports rain → `extras` / `weatherCaveat` on outdoor POIs. Gemini is told only to mention weather if Additional context says so. Script may add a short rain caveat; it must not invent storms.

## What Around does *not* do

- No continuous tracking / trip  
- No “coming up in 15 minutes” highway logic (that’s Drive)  
- No dependency on Plan prefetch  

## Slide checklist

- [ ] Job: here-and-now spoken nearby  
- [ ] Pipeline diagram: GPS → Wiki/OSM → hours/weather → Clef? → Gemini → TTS  
- [ ] Mood = History example with 3 POIs + sample prompt snippet  
- [ ] More nearby = list + taste, no mass TTS  
