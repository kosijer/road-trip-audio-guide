# Settings & Profile

**Entry:** Header account menu → Settings / Profile (not bottom tabs)  
**Code:** `src/screens/SettingsScreen.tsx`, `src/screens/ProfileScreen.tsx`

## Settings — purpose

Tune how Along listens and speaks; debug without a car.

### Controls

| Control | Effect |
|---------|--------|
| UI language | EN / SR labels |
| Narration follows UI / separate | Language of Gemini + TTS script |
| Speech rate | TTS speed 0.50×–1.50× |
| Trip speed threshold | Drive counts as “moving” above this (walk ~3–5, bike ~8–12, car ~25) |
| Debug location | Fake pin: London / Notting Hill / Westminster / Belgrade / real GPS |
| Simulate driving motion | With a fake pin: move east ~48 km/h so Drive demos work on emulator |
| Diagnostics | Last location, LLM call count, prefetch count |

### Example — Emulator Drive demo

1. Settings → Debug location → **London**  
2. Enable **Simulate driving motion**  
3. Drive → Start Trip  
4. App reports moving ~48 km/h heading east  
5. Coming-up teasers use town-scale lead times for that speed  

### Example — Real bike trip

1. Speed threshold → **10 km/h**  
2. Debug location → Real GPS  
3. Drive → Start Trip while cycling  

## Profile — purpose

Transparent **taste profile**: per-category interest from learned Beta stats, mute categories, optional identity fields (placeholder avatar).

### What you see

- Categories (castles, nature, WW2, …) with interest / “still learning”  
- Mute / unmute (mute beats learned preference in ranking)  
- Reset profile (destructive confirm)

### How it connects to screens

| Action elsewhere | Lands in Profile |
|------------------|------------------|
| 👍/👎 on Around story / More nearby / Plan / History | Category stats |
| Drive skip | Weak `skipped` signal |
| Session mood (History/Nature/Surprise) | Temporary boost, not permanent profile |

## Prompt / API note

Settings and Profile **do not** call Gemini. They only change inputs that later Around/Drive/Plan flows read (language, mood already set on those tabs, speed, location override, muted categories).

## Slide checklist

- [ ] Settings = speech + motion + debug  
- [ ] Threshold icons: walk / bike / car  
- [ ] Simulate motion for demo reel  
- [ ] Profile = editable taste transparency  
