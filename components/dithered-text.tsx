"use client"

import { useEffect, useRef, useState } from "react"

interface DitheredTextProps {
  title: string
  content: string
  color?: string
  pixelSize?: number
  className?: string
}

export function DitheredText({
  title,
  content,
  color = "#36454F",
  pixelSize = 3,
  className = "",
}: DitheredTextProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: rect.height })
      }
    }
    
    updateDimensions()
    const observer = new ResizeObserver(updateDimensions)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!canvasRef.current || dimensions.width === 0) return

    const canvas = canvasRef.current
    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.scale(dpr, dpr)

    // Bayer 8x8 dithering matrix
    const bayer8x8 = [
      [ 0, 32,  8, 40,  2, 34, 10, 42],
      [48, 16, 56, 24, 50, 18, 58, 26],
      [12, 44,  4, 36, 14, 46,  6, 38],
      [60, 28, 52, 20, 62, 30, 54, 22],
      [ 3, 35, 11, 43,  1, 33,  9, 41],
      [51, 19, 59, 27, 49, 17, 57, 25],
      [15, 47,  7, 39, 13, 45,  5, 37],
      [63, 31, 55, 23, 61, 29, 53, 21],
    ]

    const render = () => {
      timeRef.current += 0.016
      
      // Clear canvas
      ctx.clearRect(0, 0, dimensions.width, dimensions.height)

      // Create offscreen canvas for text
      const textCanvas = document.createElement("canvas")
      textCanvas.width = dimensions.width
      textCanvas.height = dimensions.height
      const textCtx = textCanvas.getContext("2d")
      if (!textCtx) return

      // Render text to offscreen canvas
      textCtx.fillStyle = "#000"
      textCtx.font = "bold 20px 'Nunito Sans', sans-serif"
      textCtx.fillText(title, 0, 24)
      
      textCtx.font = "400 11px 'Nunito Sans', sans-serif"
      const words = content.split(" ")
      let line = ""
      let y = 44
      const maxWidth = dimensions.width - 10
      const lineHeight = 16

      for (const word of words) {
        const testLine = line + word + " "
        const metrics = textCtx.measureText(testLine)
        if (metrics.width > maxWidth && line !== "") {
          textCtx.fillText(line, 0, y)
          line = word + " "
          y += lineHeight
        } else {
          line = testLine
        }
      }
      textCtx.fillText(line, 0, y)

      // Get text pixel data
      const textData = textCtx.getImageData(0, 0, dimensions.width, dimensions.height)

      // Apply dithering with subtle animation
      ctx.fillStyle = color
      
      for (let py = 0; py < dimensions.height; py += pixelSize) {
        for (let px = 0; px < dimensions.width; px += pixelSize) {
          const i = (py * dimensions.width + px) * 4
          const alpha = textData.data[i + 3]
          
          if (alpha > 10) {
            // Bayer threshold with subtle time-based variation
            const bx = Math.floor(px / pixelSize) % 8
            const by = Math.floor(py / pixelSize) % 8
            const threshold = bayer8x8[by][bx] / 64
            
            // Add subtle noise animation
            const noise = Math.sin(px * 0.1 + py * 0.1 + timeRef.current * 0.5) * 0.05
            const alphaValue = alpha / 255
            
            if (alphaValue > threshold * 0.4 + 0.1 + noise) {
              ctx.fillRect(px, py, pixelSize - 1, pixelSize - 1)
            }
          }
        }
      }

      animationRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [dimensions, title, content, color, pixelSize])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  )
}
