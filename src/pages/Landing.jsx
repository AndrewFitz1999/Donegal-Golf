import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCompetition } from '../lib/data'

const DAY_META = {
  1: { label: 'Saturday', type: 'Singles Stableford' },
  2: { label: 'Sunday', type: 'Scramble Stableford' },
}

export default function Landing() {
  const [competitions, setCompetitions] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all([getCompetition(1), getCompetition(2)]).then(([d1, d2]) => {
      if (!cancelled) setCompetitions({ 1: d1, 2: d2 })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="app-shell">
      <div className="landing-hero">
        <div className="landing-kicker">Golf Weekend</div>
        <h1 className="landing-title">Donegal</h1>
        <p className="landing-sub">Two courses, two competitions, one weekend. Pick a day to score or check the leaderboard.</p>
      </div>

      <div className="day-cards">
        {[1, 2].map((day) => (
          <Link key={day} to={`/day/${day}`} className="day-card">
            <div className="day-card-label">{DAY_META[day].label} · Day {day}</div>
            <div className="day-card-title">{competitions[day]?.courses?.name || `Day ${day} Course`}</div>
            <div className="day-card-meta">{DAY_META[day].type}</div>
            <div className="day-card-arrow">→</div>
          </Link>
        ))}
      </div>

      <Link to="/setup" className="setup-link">
        ⚙ Setup — courses, players & teams
      </Link>
    </div>
  )
}
