import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Avatar, { AvatarPair } from '../components/Avatar.jsx'
import { getCompetition, getHoles, getScores, subscribeToScores } from '../lib/data'
import { loadEntrants } from '../lib/entrants'
import { stablefordPoints } from '../lib/scoring'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

const DAY_LABEL = { 1: 'Saturday', 2: 'Sunday' }

export default function Dashboard() {
  const { day } = useParams()
  const [state, setState] = useState({ status: 'loading', rows: [] })
  const [competition, setCompetition] = useState(null)

  const load = useCallback(async () => {
    try {
      const comp = await getCompetition(day)
      const [holes, entrants, scores] = await Promise.all([
        getHoles(comp.course_id),
        loadEntrants(day),
        getScores(comp.id),
      ])
      setCompetition(comp)
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

  usePullToRefresh(load)

  const type = competition?.type || (day === '2' ? 'scramble_stableford' : 'singles_stableford')
  const compType = type === 'scramble_stableford' ? 'Scramble Stableford' : 'Singles Stableford'

  return (
    <div className="app-shell">
      <div className="dashboard-header">
        <div>
          <div className="dashboard-kicker">Donegal Golf Weekend</div>
          <h1 className="dashboard-title">Leaderboard</h1>
        </div>
        <Link to="/setup" className="dashboard-setup-link" aria-label="Setup">
          ⚙
        </Link>
      </div>

      <div className="tabs dashboard-tabs">
        {[1, 2].map((d) => (
          <Link key={d} to={`/day/${d}`} className={`tab-btn${String(d) === day ? ' is-active' : ''}`}>
            Day {d} · {DAY_LABEL[d]}
          </Link>
        ))}
      </div>

      <div className="dashboard-meta">
        <div>
          <div className="dashboard-course">{competition?.courses?.name || `Day ${day} Course`}</div>
          <div className="dashboard-comp-type">{compType}</div>
        </div>
        <span className="live-dot">Live</span>
      </div>

      <div className="page-content">
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
            {state.rows.map((row, i) => (
              <div key={row.id} className={`leaderboard-row${i === 0 && row.points > 0 ? ' is-leader' : ''}`}>
                <div className="leaderboard-rank">{i + 1}</div>
                {row.photoUrls ? (
                  <AvatarPair names={row.names} srcs={row.photoUrls} size={38} />
                ) : (
                  <Avatar src={row.photoUrl} name={row.name} size={44} />
                )}
                <div className="leaderboard-name">
                  <div className="leaderboard-name-text">{row.name}</div>
                  <div className="leaderboard-thru">{row.thru === 0 ? 'Not started' : row.thru === 18 ? 'Final' : `Thru ${row.thru}`}</div>
                </div>
                <div className="leaderboard-points">
                  {row.points}
                  <span className="leaderboard-points-unit">pts</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pull-refresh-hint">Pull down to refresh</div>
      </div>

      <div className="action-bar">
        <div className="action-bar-inner">
          <Link to={`/day/${day}/score`} className="btn btn-primary">
            Enter Score
          </Link>
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

  rows.sort((a, b) => b.points - a.points || b.thru - a.thru)
  return rows
}
