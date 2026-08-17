function initials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Avatar({ src, name, size = 40 }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) }
  if (src) {
    return <img className="avatar" style={style} src={src} alt="" />
  }
  return (
    <div className="avatar avatar-fallback" style={style}>
      {initials(name)}
    </div>
  )
}

export function AvatarPair({ names = [], srcs = [], size = 40 }) {
  return (
    <div className="avatar-pair" style={{ width: size * 1.55, height: size }}>
      <Avatar src={srcs[0]} name={names[0]} size={size} />
      <Avatar src={srcs[1]} name={names[1]} size={size} />
    </div>
  )
}
