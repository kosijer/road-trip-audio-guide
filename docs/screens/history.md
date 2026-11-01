# History

**Tab:** History  
**Code:** `src/screens/HistoryScreen.tsx`  
**Moment:** After you’ve heard places (Around, Drive, or Next).

## Purpose

Local log of narrated places so you can:

- Re-read what you heard  
- Teach the app your taste with **👍 / 👎**  
- Open the place in Maps (**pin only** — no walk/drive directions mode)

## What is stored per visit

From `VisitRecord` (AsyncStorage):

| Field | Meaning |
|-------|---------|
| title, summary, category | Place identity |
| lat / lon | For Maps pin |
| mode | `walking` or `driving` when narrated |
| narratedAt | When |
| narrationExcerpt | Short clip of the script |
| poiId | Links to preference exposures |

Stars-as-taste were an early substrate; **primary taste UI is now 👍/👎** (preference exposures). Legacy star ratings may still exist in storage from older builds.

## User flow

```
Open History
  → load visits (newest-oriented list)
  → for each poiId, load last exposure outcome if liked / not_interested
  → expand row → summary + excerpt + PreferenceFeedback + Maps pin
  → Clear history (confirm)
```

### Maps link

Opens:

`https://www.google.com/maps/search/?api=1&query={lat},{lng}`

So Google shows **the place**, not a navigation mode.

### Taste write path

```
👍 / 👎 on a visit
  → applyTasteForVisit
      → ensure POI stub in cache if missing
      → reuse or create preference exposure
      → setExposureOutcome(liked | not_interested)
  → Beta category stats update (with uncertainty / viability rules from prefs spec)
```

## Example — After a Westminster Around session

**History rows (illustrative)**

| When | Title | Mode | Trailing |
|------|-------|------|----------|
| Today 14:02 | Westminster Abbey | Walk | 👍 |
| Today 13:40 | Jewel Tower | Walk | (none yet) |

**User expands Jewel Tower**

- Summary from Wikipedia extract  
- Excerpt of spoken script  
- Taps **Not my thing** → `not_interested` on categories (e.g. if classified `architecture` / `medieval_castles`)  
- Taps **Open in Maps** → pin on Jewel Tower  

**Effect later**

- Around **More nearby**, Plan ranking, and Drive candidate ranking softly down-weight that category until more evidence accumulates (bounded, with exploration — see preferences spec).

## Example — Drive skip vs History

- Skip on Drive teaser → exposure `skipped` (weak signal); may **not** create a full History visit if full narration never ran.  
- History is primarily **places you heard** (full narration + `recordVisit`).

## What History does *not* do

- No live discovery  
- No Gemini calls  
- No trip control  

## Slide checklist

- [ ] History = memory + taste teacher  
- [ ] 👍/👎 → preference stats  
- [ ] Maps = pin only  
- [ ] One row example with Abbey liked / Jewel disliked  
