"use client"

import { Dithering } from "@paper-design/shaders-react"
import { useRef, useState, useEffect } from "react"

interface DitheredMapProps {
  imageSrc?: string
  colorBack?: string
  colorFront?: string
  pxSize?: number
  animated?: boolean
  speed?: number
  shape?: "simplex" | "warp" | "dots" | "wave" | "ripple" | "swirl" | "sphere"
}

export function DitheredMap({
  colorBack = "hsl(0, 0%, 0%)",
  colorFront = "hsl(320, 100%, 70%)",
  pxSize = 3,
  animated = true,
  speed = 0.3,
  shape = "simplex",
}: DitheredMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: rect.height })
      }
    }

    updateDimensions()

    const resizeObserver = new ResizeObserver(updateDimensions)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Dithering
          colorBack={colorBack}
          colorFront={colorFront}
          size={pxSize}
          type="8x8"
          shape={shape}
          scale={0.8}
          speed={animated ? speed : 0}
          width={dimensions.width}
          height={dimensions.height}
        />
      )}
    </div>
  )
}
