import { Routes, Route, Navigate } from 'react-router-dom'
import Setup from './pages/Setup.jsx'
import Dashboard from './pages/Dashboard.jsx'
import DayScorer from './pages/DayScorer.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/day/1" replace />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/day/:day" element={<Dashboard />} />
      <Route path="/day/:day/score" element={<DayScorer />} />
    </Routes>
  )
}

export default App
