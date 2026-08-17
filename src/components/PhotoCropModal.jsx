import { useEffect, useRef, useState } from 'react'

const FRAME_WIDTH = 300
const OUTPUT_WIDTH = 1400

// Lets the user pick which part of a photo shows in a fixed-aspect banner,
// instead of leaving it to CSS background-size:cover to crop blindly.
export default function PhotoCropModal({ file, aspect, onCancel, onConfirm }) {
  const frameHeight = Math.round(FRAME_WIDTH / aspect)
  const [img, setImg] = useState(null)
  const [scale, setScale] = useState(1)
  const [minScale, setMinScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const cover = Math.max(FRAME_WIDTH / image.width, frameHeight / image.height)
      setImg(image)
      setMinScale(cover)
      setScale(cover)
      setOffset({
        x: (FRAME_WIDTH - image.width * cover) / 2,
        y: (frameHeight - image.height * cover) / 2,
      })
    }
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [file, frameHeight])

  function clampOffset(next, s) {
    if (!img) return next
    const dispW = img.width * s
    const dispH = img.height * s
    return {
      x: Math.min(0, Math.max(FRAME_WIDTH - dispW, next.x)),
      y: Math.min(0, Math.max(frameHeight - dispH, next.y)),
    }
  }

  function handlePointerDown(e) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, offset }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setOffset(clampOffset({ x: dragRef.current.offset.x + dx, y: dragRef.current.offset.y + dy }, scale))
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  function handleZoom(e) {
    const nextScale = Number(e.target.value)
    setScale(nextScale)
    setOffset((prev) => clampOffset(prev, nextScale))
  }

  function confirm() {
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_WIDTH
    canvas.height = Math.round(OUTPUT_WIDTH / aspect)
    const ctx = canvas.getContext('2d')
    const sx = -offset.x / scale
    const sy = -offset.y / scale
    const sWidth = FRAME_WIDTH / scale
    const sHeight = frameHeight / scale
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => onConfirm(blob), 'image/jpeg', 0.88)
  }

  return (
    <div className="crop-modal">
      <div className="crop-modal-card">
        <div className="crop-modal-title">Adjust photo</div>
        <div
          className="crop-frame"
          style={{ width: FRAME_WIDTH, height: frameHeight }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {img && (
            <img
              src={img.src}
              alt=""
              draggable={false}
              style={{
                width: img.width * scale,
                height: img.height * scale,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
        </div>

        {img && (
          <input
            className="crop-zoom"
            type="range"
            min={minScale}
            max={minScale * 3}
            step={minScale / 100}
            value={scale}
            onChange={handleZoom}
          />
        )}

        <div className="crop-modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={confirm} disabled={!img}>
            Use this crop
          </button>
        </div>
      </div>
    </div>
  )
}
