# Along — screen documentation (for demos / PowerPoint)

One file per main surface. Use these as speaker notes and slide sources.

| Screen | File | Moment | Job |
|--------|------|--------|-----|
| **Around** | [around.md](./around.md) | Here and now | “What’s around me?” spoken guide + optional more list |
| **Drive** | [drive.md](./drive.md) | In motion (car / bike / …) | Coming-up teaser → hold → full story along heading |
| **Plan** | [plan.md](./plan.md) | Ahead of time / at home | Browse A→B or inspire loop; feed taste; optional cache |
| **History** | [history.md](./history.md) | After the fact | Past narrations; 👍/👎; open place in Maps |
| **Settings / Profile** | [settings-and-profile.md](./settings-and-profile.md) | Config | Language, speech, speed threshold, debug location / motion, taste profile |

## Product split (one slide)

- **Plan ≠ commitment to drive.** Planning can be browsing + liking.
- **Drive ≠ Plan queue.** Drive uses heading + live/cache discovery; Plan prefetch is optional fuel, not required.
- **Around ≠ Drive.** Around is one-shot nearby; Drive is continuous while moving.

## Shared building blocks

| Piece | Role |
|-------|------|
| Wikipedia + OSM Overpass (+ Wikidata) | Discover POIs |
| Google Places Details | Opening hours (when available) |
| Open-Meteo | Rain / weather caveats (Around) |
| Google Maps SDK / Maps links | Map UI; open place or directions |
| Cloudflare Clef (optional) | Decide *which* POI to narrate |
| Google Gemini | Write the spoken script |
| On-device TTS | Speak the script |
| Preferences (Beta / Thompson) | Taste ranking + 👍/👎 learning |

## Related design specs

- [Drive v2 coming-up](../superpowers/specs/2026-11-01-drive-v2-coming-up-design.md)
- [Plan Inspire + Around five more](../superpowers/specs/2026-11-01-inspire-loop-design.md)
- Root: `personal-preferences-spec.md`, `road-trip-audio-guide-PRD.md`
