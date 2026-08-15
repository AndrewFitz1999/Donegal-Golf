import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Setup from './pages/Setup.jsx'
import DayLeaderboard from './pages/DayLeaderboard.jsx'
import DayScorer from './pages/DayScorer.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/day/:day" element={<DayLeaderboard />} />
      <Route path="/day/:day/score" element={<DayScorer />} />
    </Routes>
  )
}

export default App
