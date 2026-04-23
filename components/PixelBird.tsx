"use client"

import { useRef, useEffect, useState, useCallback } from "react"

// ─── Canvas bird constants ────────────────────────────────────────────────────
const BIRD_W   = 300
const BIRD_H   = 210
const FONT     = '8px "Courier New", monospace'
const LINE_H   = 7
const CHAR_W   = 4.8
const POOL     = '@#%XKO0NB**+=?.-:,;~'
const FLAP_MS  = 145
const SEQ      = [0, 1, 2, 3, 4, 3, 2, 1]

function sc(row: number, col: number): string {
  const h = ((row * 1619 + col * 937 + 17) ^ ((row * 937 + col * 1619) >> 3)) & 0x7fff
  return POOL[Math.floor((h / 32767) * POOL.length)]
}
function rc(): string { return POOL[Math.floor(Math.random() * POOL.length)] }

function fillASCII(ctx: CanvasRenderingContext2D, shimmer: boolean, color: string) {
  ctx.font = FONT
  ctx.fillStyle = color
  const rows = Math.ceil(BIRD_H / LINE_H)
  const cols = Math.ceil(BIRD_W / CHAR_W)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = (shimmer && Math.random() < 0.12) ? rc() : sc(r, c)
      ctx.fillText(ch, c * CHAR_W, r * LINE_H + LINE_H)
    }
  }
}

function buildBody(ctx: CanvasRenderingContext2D) {
  ctx.moveTo(50, 88)
  ctx.bezierCurveTo(30, 88, 16, 96, 14, 105)
  ctx.bezierCurveTo(12, 114, 20, 124, 36, 128)
  ctx.bezierCurveTo(50, 132, 68, 128, 78, 120)
  ctx.bezierCurveTo(95, 130, 120, 138, 148, 144)
  ctx.bezierCurveTo(175, 150, 195, 152, 210, 150)
  ctx.bezierCurveTo(224, 148, 240, 155, 252, 162)
  ctx.bezierCurveTo(260, 166, 264, 165, 262, 160)
  ctx.bezierCurveTo(260, 155, 248, 148, 238, 142)
  ctx.bezierCurveTo(220, 132, 200, 120, 175, 110)
  ctx.bezierCurveTo(155, 102, 130, 96, 108, 92)
  ctx.bezierCurveTo(92, 89, 76, 86, 64, 86)
  ctx.bezierCurveTo(56, 85, 50, 85, 50, 88)
  ctx.moveTo(14, 105)
  ctx.lineTo(2, 102)
  ctx.lineTo(6, 108)
  ctx.closePath()
}

interface WingShape {
  tipX: number; tipY: number
  fcp1: [number, number]; fcp2: [number, number]
  bcp1: [number, number]; bcp2: [number, number]
}

const WINGS: WingShape[] = [
  { tipX: 120, tipY: 4,   fcp1: [88,40],   fcp2: [106,14],  bcp1: [136,14],  bcp2: [158,40]  },
  { tipX: 196, tipY: 20,  fcp1: [112,52],  fcp2: [158,24],  bcp1: [190,28],  bcp2: [196,52]  },
  { tipX: 276, tipY: 86,  fcp1: [160,68],  fcp2: [230,74],  bcp1: [242,86],  bcp2: [240,100] },
  { tipX: 240, tipY: 162, fcp1: [148,112], fcp2: [206,142], bcp1: [232,166], bcp2: [216,168] },
  { tipX: 118, tipY: 198, fcp1: [84,148],  fcp2: [104,186], bcp1: [130,192], bcp2: [152,168] },
  { tipX: 200, tipY: 138, fcp1: [128,118], fcp2: [172,130], bcp1: [212,144], bcp2: [200,118] },
]

function buildWing(ctx: CanvasRenderingContext2D, w: WingShape) {
  ctx.moveTo(78, 88)
  ctx.bezierCurveTo(w.fcp1[0], w.fcp1[1], w.fcp2[0], w.fcp2[1], w.tipX, w.tipY)
  ctx.bezierCurveTo(w.bcp1[0], w.bcp1[1], w.bcp2[0], w.bcp2[1], 170, 95)
  ctx.lineTo(78, 88)
}

function drawFrame(ctx: CanvasRenderingContext2D, frameIdx: number, shimmer: boolean, hovered: boolean) {
  const color = hovered ? 'rgba(231,231,208,0.97)' : 'rgba(231,231,208,0.88)'
  ctx.clearRect(0, 0, BIRD_W, BIRD_H)
  ctx.save()
  ctx.beginPath()
  buildWing(ctx, WINGS[frameIdx])
  ctx.closePath()
  ctx.clip()
  fillASCII(ctx, shimmer, color)
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  buildBody(ctx)
  ctx.clip()
  fillASCII(ctx, shimmer, color)
  ctx.restore()
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface BirdStory {
  blurb: string
  href: string
  linkText: string
  audioSrc: string | null
  audioTitle: string
  audioArtist: string
}

// ─── Mini audio player ────────────────────────────────────────────────────────
function AudioPlayer({ src, title, artist }: { src: string | null; title: string; artist: string }) {
  const audioRef   = useRef<HTMLAudioElement | null>(null)
  const [playing,  setPlaying]  = useState(false)
  const [progress, setProgress] = useState(0)
  const [elapsed,  setElapsed]  = useState(0)
  const [duration, setDuration] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => () => {
    audioRef.current?.pause()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const tick = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    setElapsed(a.currentTime)
    setProgress(a.duration ? a.currentTime / a.duration : 0)
    if (!a.paused) rafRef.current = requestAnimationFrame(tick)
  }, [])

  const togglePlay = () => {
    const a = audioRef.current
    if (!a || !src) return
    if (a.paused) { a.play(); setPlaying(true); rafRef.current = requestAnimationFrame(tick) }
    else { a.pause(); setPlaying(false); if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current
    if (!a || !a.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration
    setElapsed(a.currentTime)
    setProgress(a.currentTime / a.duration)
  }

  const skip = (d: number) => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + d))
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`
  const unavailable = !src

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid rgba(231,231,208,0.12)", paddingTop: 10 }}>
      {src && (
        <audio ref={audioRef} src={src} preload="metadata"
          onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
          onEnded={() => { setPlaying(false); setProgress(0); setElapsed(0) }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-end", gap: 2, height: 16 }}>
          {[8,12,6,14,10,5,12].map((h, i) => (
            <div key={i} style={{
              width: 2, height: h, borderRadius: 1,
              background: playing ? "rgba(231,231,208,0.85)" : "rgba(231,231,208,0.3)",
              animation: playing ? `waveBar${i % 3} 0.6s ease-in-out infinite alternate` : "none",
              animationDelay: `${i * 0.07}s`,
            }} />
          ))}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "rgba(231,231,208,0.9)", fontWeight: 600, letterSpacing: "0.03em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
          <div style={{ fontSize: 11, color: "rgba(231,231,208,0.45)", letterSpacing: "0.04em" }}>{artist}</div>
        </div>
      </div>
      <div onClick={seek} style={{ height: 3, background: "rgba(231,231,208,0.12)", borderRadius: 2, marginBottom: 6, cursor: unavailable ? "default" : "pointer", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${progress * 100}%`, background: "rgba(231,231,208,0.65)", borderRadius: 2, transition: "width 0.1s linear" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => skip(-10)} disabled={unavailable} style={{ background: "none", border: "none", padding: "2px 4px", color: unavailable ? "rgba(231,231,208,0.18)" : "rgba(231,231,208,0.55)", cursor: unavailable ? "default" : "pointer", fontSize: 13 }}>⏮</button>
          <button onClick={togglePlay} disabled={unavailable} style={{ background: unavailable ? "rgba(231,231,208,0.08)" : "rgba(231,231,208,0.18)", border: "none", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", color: unavailable ? "rgba(231,231,208,0.25)" : "rgba(231,231,208,0.9)", cursor: unavailable ? "default" : "pointer", fontSize: 11 }}>
            {playing ? "⏸" : "▶"}
          </button>
          <button onClick={() => skip(10)} disabled={unavailable} style={{ background: "none", border: "none", padding: "2px 4px", color: unavailable ? "rgba(231,231,208,0.18)" : "rgba(231,231,208,0.55)", cursor: unavailable ? "default" : "pointer", fontSize: 13 }}>⏭</button>
        </div>
        <div style={{ fontSize: 10, color: "rgba(231,231,208,0.35)", letterSpacing: "0.05em", fontVariantNumeric: "tabular-nums" }}>
          {unavailable ? "no file" : `${fmt(elapsed)} / ${fmt(duration)}`}
        </div>
      </div>
      <style>{`
        @keyframes waveBar0 { from{height:5px} to{height:13px} }
        @keyframes waveBar1 { from{height:8px} to{height:4px}  }
        @keyframes waveBar2 { from{height:3px} to{height:11px} }
      `}</style>
    </div>
  )
}

// ─── PixelBird ────────────────────────────────────────────────────────────────
export function PixelBird({
  positionClass = "",
  startSeq = 0,
  story,
  scale = 0.38,
  mobileScale = 0.26,
  inline = false,
}: {
  /** Tailwind responsive positioning classes (fixed mode only) */
  positionClass?: string
  startSeq?: number
  story: BirdStory
  /** Desktop display scale. Default 0.38 ≈ 114×80 px */
  scale?: number
  /** Mobile display scale. Default 0.26 ≈ 78×55 px */
  mobileScale?: number
  /** When true: renders relative (scrolls with page), used for mobile inline placement */
  inline?: boolean
}) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [seqIdx,   setSeqIdx]   = useState(startSeq % SEQ.length)
  const [hovered,  setHovered]  = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawFrame(ctx, SEQ[seqIdx], true, hovered)
  }, [seqIdx, hovered])

  useEffect(() => {
    const id = setInterval(() => setSeqIdx(i => (i + 1) % SEQ.length), FLAP_MS)
    return () => clearInterval(id)
  }, [])

  // Close overlay when tapping outside (inline/mobile)
  useEffect(() => {
    if ((!inline && !isMobile) || !hovered) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setHovered(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [inline, isMobile, hovered])

  const handleEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    setHovered(true)
  }
  const handleLeave = () => {
    leaveTimer.current = setTimeout(() => setHovered(false), 120)
  }
  // Tap toggles overlay (inline mode or mobile)
  const handleClick = () => {
    if (!inline && !isMobile) return
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    setHovered(h => !h)
  }

  const activeScale = (inline || isMobile) ? mobileScale : scale
  const displayW    = BIRD_W * activeScale
  const displayH    = BIRD_H * activeScale

  // Overlay: centered modal for inline/mobile; beside bird for desktop hover
  const overlayStyle: React.CSSProperties = (inline || isMobile)
    ? { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(300px, 88vw)" }
    : { position: "absolute", top: 0, left: displayW + 10, width: 300 }

  // Inline birds scroll with the page (relative); fixed birds float over the map
  const containerClass = inline
    ? `relative ${hovered ? "z-[60]" : "z-30"}`
    : `fixed ${hovered ? "z-[60]" : "z-30"} ${positionClass}`

  return (
    <div
      ref={containerRef}
      className={containerClass}
      style={{ width: displayW, height: displayH }}
      onMouseEnter={!inline && !isMobile ? handleEnter : undefined}
      onMouseLeave={!inline && !isMobile ? handleLeave : undefined}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        width={BIRD_W}
        height={BIRD_H}
        style={{ width: displayW, height: displayH, display: "block", cursor: "pointer" }}
      />

      {hovered && (
        <div
          onMouseEnter={!inline && !isMobile ? handleEnter : undefined}
          onMouseLeave={!inline && !isMobile ? handleLeave : undefined}
          style={{
            ...overlayStyle,
            background: "rgba(22, 32, 37, 0.97)",
            border: "1px solid rgba(231,231,208,0.14)",
            borderRadius: 4,
            padding: "14px 16px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            pointerEvents: "auto",
            zIndex: 60,
          }}
        >
          <p style={{ fontSize: 13, lineHeight: 1.65, color: "rgba(231,231,208,0.82)", margin: 0, marginBottom: 10 }}>
            {story.blurb}
          </p>
          <a href={story.href} target="_blank" rel="noopener noreferrer" style={{
            fontSize: 12, color: "rgba(231,231,208,0.6)", textDecoration: "underline",
            textUnderlineOffset: 3, letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            {story.linkText} →
          </a>
          <AudioPlayer src={story.audioSrc} title={story.audioTitle} artist={story.audioArtist} />
        </div>
      )}
    </div>
  )
}
