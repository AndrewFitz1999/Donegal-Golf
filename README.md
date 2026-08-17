# Donegal Golf Weekend

A mobile-first scoring app for a 4-player golf weekend: two days, two courses, two
separate Stableford competitions. No login — just share the links.

## Stack

- React + Vite
- Supabase (Postgres + Realtime)
- Deploy target: Vercel

## Project structure

```
src/
  lib/
    supabase.js    Supabase client
    data.js        All Supabase queries + storage upload (courses, holes, players, teams, scores, photos)
    entrants.js    Normalizes Day 1 players / Day 2 teams into one shape
    scoring.js     Stableford points + strokes-received logic (pure functions)
    image.js       Client-side photo downscale before upload
  pages/
    Dashboard.jsx  Trip hero + Day 1/Day 2 tabs + that day's live leaderboard + Enter Score
    Setup.jsx      Trip hero/title, courses, players (incl. photos), teams (names + photos)
    DayScorer.jsx  Hole-by-hole score entry, per day, with confirm-to-advance
    Scorecard.jsx  Full 18-hole scorecard for one player/team, per day
  components/
    TopBar.jsx
    Avatar.jsx     Player/team avatar with initials fallback (incl. EntrantAvatar helper)
```

`vercel.json` rewrites every path to `index.html` so client-side routes (e.g.
`/day/2`) work on a hard reload or direct link — without it Vercel 404s on
anything but `/`.

Day 1 and Day 2 are fully separate — the Dashboard shows one day's leaderboard
at a time via tabs, never a combined view. Setup (courses, players, handicaps,
Day 2 teams) is shared and entered once.

## Routes

- `/` — redirects to `/day/1`
- `/setup` — edit courses (18 holes each), players/handicaps/photos, Day 2 teams
- `/day/1` — Dashboard on the Day 1 tab (singles Stableford leaderboard)
- `/day/1/score` — Day 1 scorer
- `/day/1/scorecard/:entrantId` — full scorecard for one player
- `/day/2` — Dashboard on the Day 2 tab (scramble Stableford leaderboard)
- `/day/2/score` — Day 2 scorer
- `/day/2/scorecard/:entrantId` — full scorecard for one team

## Local development

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

## Supabase

A Supabase project has already been provisioned for this app (`donegal-golf`,
region `eu-west-1`) with the schema in place: `courses`, `holes`, `players`,
`teams`, `competitions`, `scores`, plus a public `avatars` storage bucket for
player and team profile photos. Row Level Security is enabled with fully open policies
(read/write) on every table and on the storage bucket — there's no auth, so
this only depends on the links not being shared beyond the group. `scores` is
added to the `supabase_realtime` publication so the leaderboard updates live.

Two courses and one competition per day were seeded automatically; rename the
courses and fill in real players/handicaps/holes from the **Setup** page
before the weekend.

## Deploying to Vercel

1. Push this repo to GitHub (already done if you're reading this from there).
2. Import the repo in Vercel.
3. Set environment variables in the Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Framework preset: Vite. Build command `npm run build`, output directory `dist`.
5. Deploy, then share the root link — everyone lands on the live Day 1 dashboard.

## Scoring rules

- **Day 1 (singles):** each player's `handicap_index` is used directly as
  their playing handicap. Strokes received on a hole = 1 if handicap ≥ the
  hole's stroke index, +1 more if handicap ≥ stroke index + 18, and so on.
- **Day 2 (scramble):** each team's playing handicap is the average of its
  two players' `handicap_index`, applied the same way to the team's single
  gross score per hole.
- **Points:** net score vs par — albatross or better = 5, eagle = 4, birdie = 3,
  par = 2, bogey = 1, double bogey or worse = 0.

## Notes

- Score entry writes optimistically to the UI, then to Supabase; the
  leaderboard subscribes to `scores` changes over Supabase Realtime and
  recomputes on every insert/update. A "Live · Refresh" button is a manual
  fallback — deliberately not a pull-down gesture, since iOS Safari's own
  pull-to-refresh can't be reliably suppressed from a web page and would
  otherwise fight with a custom one.
- Setup → Trip lets you set the trip title/dates and a full-bleed hero photo
  shown at the very top of the dashboard. The smallest deliberate scroll down
  commits fully to revealing the sticky day-tab bar and leaderboard beneath
  it (CSS scroll-snap plus a small JS assist, since snap alone needs a more
  decisive scroll than "just a nudge" to commit). Trip is also home to
  "Clear all scores" (confirm-gated) for wiping every score across both days
  without touching courses/players/teams/handicaps.
- The scorer requires every entrant to have a score entered for the current
  hole before "Confirm scores & next hole" is enabled, to avoid skipping
  someone by mistake. The hole picker still allows jumping to any hole to
  fix a mistake.
- Player and team photos are downscaled client-side (max 512px) before upload
  to keep it fast on course wifi. A team photo, once set, replaces its two
  players' individual avatars everywhere the team is shown.
- Each day/course can have a background photo (Setup → Courses), downscaled
  to max 1600px, shown behind that day's dashboard header/tabs with a black
  overlay for legibility. Falls back to the plain green gradient when unset.
- Scorecard scores are color-coded: under par red, par neutral, bogey blue,
  double bogey or worse dark navy.
- Day 2 teams are displayed as `PlayerA/PlayerB`, derived automatically from
  whichever two players are assigned to the team in Setup.
- The leaderboard ranks by points with proper tie handling — players/teams
  level on points share the same rank (shown as "T1", "T1", "3", …) and all
  tied leaders get the highlight, not just the first row.
- Tapping a leaderboard row opens that player's/team's full scorecard.
- Built for this one specific weekend — no historical tracking or multi-event
  support by design.
