import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { EntrantAvatar } from '../components/Avatar.jsx'
import { getCompetition, getHoles, getScores, getEventSettings, subscribeToScores } from '../lib/data'
import { loadEntrants } from '../lib/entrants'
import { stablefordPoints } from '../lib/scoring'

const DAY_LABEL = { 1: 'Friday', 2: 'Saturday' }

export default function Dashboard() {
  const { day } = useParams()
  const [state, setState] = useState({ status: 'loading', rows: [] })
  const [competition, setCompetition] = useState(null)
  const [event, setEvent] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const [comp, evt] = await Promise.all([getCompetition(day), getEventSettings()])
      const [holes, entrants, scores] = await Promise.all([
        getHoles(comp.course_id),
        loadEntrants(day),
        getScores(comp.id),
      ])
      setCompetition(comp)
      setEvent(evt)
      setState({ status: 'ready', rows: buildRows(entrants, holes, scores) })
    } catch (err) {
      console.error(err)
      setState({ status: 'error', rows: [] })
    }
  }, [day])

  useEffect(() => {
    setState({ status: 'loading', rows: [] })
    load()
  }, [load])

  useEffect(() => {
    if (!competition) return
    const unsubscribe = subscribeToScores(competition.id, () => load())
    return unsubscribe
  }, [competition, load])

  async function refresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  // Both /day/1 and /day/2 match the same route, so switching tabs re-renders
  // this component rather than remounting it — comparing against the day from
  // the last commit (via a ref, not state, so it's ready on the same render
  // the key changes) tells us which way to slide. First render gets no
  // direction, so the initial page load never animates.
  const prevDayRef = useRef(day)
  const hasMountedRef = useRef(false)
  const direction = hasMountedRef.current ? (Number(day) > Number(prevDayRef.current) ? 'left' : 'right') : null
  useEffect(() => {
    hasMountedRef.current = true
    prevDayRef.current = day
  }, [day])

  const type = competition?.type || (day === '2' ? 'scramble_stableford' : 'singles_stableford')
  const compType = type === 'scramble_stableford' ? 'Scramble Stableford' : 'Singles Stableford'

  const photoUrl = competition?.courses?.photo_url ?? null
  const prize = competition?.prize_money
  const prizeLabel = prize ? (day === '2' ? `€${prize}pp` : `€${prize}`) : null

  // The hero card itself never moves — only its background photo crossfades.
  // A settled layer (bgUrl) sits underneath at full opacity; when the photo
  // changes, the new one is layered on top and fades in, then gets promoted
  // to the settled layer once the fade finishes so the next change has a
  // clean base to fade from again.
  const [bgUrl, setBgUrl] = useState(photoUrl)
  const [fadingBgUrl, setFadingBgUrl] = useState(null)
  const bgFadeTimer = useRef(null)

  useEffect(() => {
    if (photoUrl === bgUrl) return
    setFadingBgUrl(photoUrl)
    clearTimeout(bgFadeTimer.current)
    bgFadeTimer.current = setTimeout(() => {
      setBgUrl(photoUrl)
      setFadingBgUrl(null)
    }, 380)
    return () => clearTimeout(bgFadeTimer.current)
  }, [photoUrl, bgUrl])

  const showTripPhoto = !event?.hero_hidden && event?.hero_photo_url

  return (
    <div className="app-shell">
      <div
        className={`trip-hero${showTripPhoto ? '' : ' trip-hero-no-image'}`}
        style={showTripPhoto ? { backgroundImage: `url(${event.hero_photo_url})` } : undefined}
      >
        <div className="trip-hero-scrim" />
        <div className="trip-hero-content">
          <div className="trip-hero-title">{event?.title || 'Golf Weekend'}</div>
          {event?.subtitle && <div className="trip-hero-subtitle">{event.subtitle}</div>}
        </div>
        <div className="trip-hero-fade" />
      </div>

      <div className="dashboard-tabbar">
        <div className="tabs dashboard-tabs">
          {[1, 2].map((d) => (
            <Link key={d} to={`/day/${d}`} className={`tab-btn${String(d) === day ? ' is-active' : ''}`}>
              Day {d} · {DAY_LABEL[d]}
            </Link>
          ))}
        </div>
        <Link to="/setup" className="dashboard-setup-link" aria-label="Setup">
          ⚙
        </Link>
      </div>

      <div className="dashboard-hero">
        {bgUrl && <div className="dashboard-hero-bg" style={{ backgroundImage: `url(${bgUrl})` }} />}
        {fadingBgUrl && (
          <div key={fadingBgUrl} className="dashboard-hero-bg dashboard-hero-bg-fade-in" style={{ backgroundImage: `url(${fadingBgUrl})` }} />
        )}
        <div className="dashboard-hero-scrim" />
        <div className="dashboard-hero-content">
          <div className="dashboard-kicker">Donegal Golf Weekend</div>
          <h1 className="dashboard-title">Leaderboard</h1>

          <div className="dashboard-meta">
            <div>
              <div key={`course-${day}`} className="dashboard-course fade-text">
                {competition?.courses?.name || `Day ${day} Course`}
              </div>
              <div key={`type-${day}`} className="dashboard-comp-type fade-text">
                {compType}
              </div>
              {prizeLabel && (
                <div key={`prize-${day}`} className="prize-badge fade-text">
                  🏆 {prizeLabel}
                </div>
              )}
            </div>
            <button className="live-dot refresh-btn" onClick={refresh} disabled={refreshing} aria-label="Refresh">
              {refreshing ? 'Refreshing…' : 'Live · Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-slide-viewport">
        <div key={day} className={`dashboard-slide-panel${direction ? ` slide-${direction}` : ''}`}>
          {state.status === 'loading' && <div className="state-message">Loading leaderboard…</div>}

          {state.status === 'error' && (
            <div className="state-message">
              Couldn't load the leaderboard. Check your connection.
              <div style={{ marginTop: 14 }}>
                <button className="btn btn-secondary" onClick={load}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {state.status === 'ready' && (
            <div className="leaderboard-list">
              {state.rows.map((row) => (
                <Link
                  key={row.id}
                  to={`/day/${day}/scorecard/${row.id}`}
                  className={`leaderboard-row${row.rank === 1 && row.points > 0 ? ' is-leader' : ''}`}
                >
                  <div className="leaderboard-rank">{row.tied ? `T${row.rank}` : row.rank}</div>
                  <EntrantAvatar entrant={row} size={44} />
                  <div className="leaderboard-name">
                    <div className="leaderboard-name-text">{row.name}</div>
                    <div className="leaderboard-thru">{row.thru === 0 ? 'Not started' : row.thru === 18 ? 'Final' : `Thru ${row.thru}`}</div>
                  </div>
                  <div className="leaderboard-points">
                    {row.points}
                    <span className="leaderboard-points-unit">pts</span>
                  </div>
                  <div className="leaderboard-chevron">›</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function buildRows(entrants, holes, scores) {
  const holesByNumber = Object.fromEntries(holes.map((h) => [h.hole_number, h]))
  const scoresByEntrant = {}
  for (const s of scores) {
    scoresByEntrant[s.entrant_id] ??= []
    scoresByEntrant[s.entrant_id].push(s)
  }

  const rows = entrants.map((entrant) => {
    const entrantScores = scoresByEntrant[entrant.id] || []
    let points = 0
    let thru = 0
    for (const s of entrantScores) {
      if (s.gross_strokes == null) continue
      const hole = holesByNumber[s.hole_number]
      if (!hole) continue
      thru += 1
      points += stablefordPoints(s.gross_strokes, hole.par, hole.stroke_index, entrant.handicap) || 0
    }
    return {
      id: entrant.id,
      name: entrant.name,
      points,
      thru,
      photoUrl: entrant.photoUrl,
      photoUrls: entrant.photoUrls,
      names: entrant.names,
    }
  })

  // Sort by points; use thru only to order rows with equal points
  // deterministically — it does not break the tie itself.
  rows.sort((a, b) => b.points - a.points || b.thru - a.thru)

  let rank = 1
  rows.forEach((row, i) => {
    if (i > 0 && row.points !== rows[i - 1].points) rank = i + 1
    row.rank = rank
  })
  rows.forEach((row) => {
    row.tied = rows.filter((r) => r.rank === row.rank).length > 1
  })

  return rows
}
