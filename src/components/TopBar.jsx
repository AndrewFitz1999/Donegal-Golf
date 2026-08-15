import { Link } from 'react-router-dom'

export default function TopBar({ title, subtitle, backTo = '/' }) {
  return (
    <div className="topbar">
      <Link to={backTo} className="topbar-back" aria-label="Back">
        ←
      </Link>
      <div>
        <div className="topbar-title">{title}</div>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>
    </div>
  )
}
