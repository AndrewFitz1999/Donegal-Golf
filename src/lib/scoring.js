// Stableford scoring shared by Day 1 (singles) and Day 2 (scramble).
// Playing handicap is used directly as the course handicap, per the
// weekend's simplified rules.

export function strokesReceived(playingHandicap, strokeIndex) {
  let strokes = 0
  let threshold = strokeIndex
  while (playingHandicap >= threshold) {
    strokes += 1
    threshold += 18
  }
  return strokes
}

export function stablefordPoints(grossStrokes, par, strokeIndex, playingHandicap) {
  if (grossStrokes == null || grossStrokes <= 0) return null
  const received = strokesReceived(playingHandicap, strokeIndex)
  const net = grossStrokes - received
  const diff = net - par
  if (diff <= -3) return 5
  if (diff === -2) return 4
  if (diff === -1) return 3
  if (diff === 0) return 2
  if (diff === 1) return 1
  return 0
}

// Day 2 team playing handicap: average of the two players' handicap_index.
export function teamHandicap(handicapA, handicapB) {
  return (Number(handicapA) + Number(handicapB)) / 2
}
