"use client"

import { useEffect, useRef, useCallback, useState } from "react"

interface AnimatedMapParticlesProps {
  imageSrc: string
  colorBack?: string
  colorFront?: string
  pixelSize?: number
  speed?: number
  className?: string
}

interface Particle {
  x: number
  y: number
  baseX: number
  baseY: number
  size: number
  phase: number
  speed: number
}

export function AnimatedMapParticles({
  imageSrc,
  colorBack = "#F5F5DC",
  colorFront = "#36454F",
  pixelSize = 4,
  speed = 1,
  className = "",
}: AnimatedMapParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number>(0)
  const [isLoaded, setIsLoaded] = useState(false)

  const extractParticlesFromImage = useCallback(
    (img: HTMLImageElement, canvasWidth: number, canvasHeight: number) => {
      // Create offscreen canvas to read image data
      const offscreen = document.createElement("canvas")
      const offCtx = offscreen.getContext("2d", { willReadFrequently: true })
      if (!offCtx) return []

      // Calculate scaling to fit image in canvas (cover)
      const imgAspect = img.width / img.height
      const canvasAspect = canvasWidth / canvasHeight
      let drawWidth, drawHeight, offsetX, offsetY

      if (imgAspect > canvasAspect) {
        drawHeight = canvasHeight
        drawWidth = canvasHeight * imgAspect
        offsetX = (canvasWidth - drawWidth) / 2
        offsetY = 0
      } else {
        drawWidth = canvasWidth
        drawHeight = canvasWidth / imgAspect
        offsetX = 0
        offsetY = (canvasHeight - drawHeight) / 2
      }

      offscreen.width = canvasWidth
      offscreen.height = canvasHeight
      offCtx.fillStyle = "#000000"
      offCtx.fillRect(0, 0, canvasWidth, canvasHeight)
      offCtx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)

      const imageData = offCtx.getImageData(0, 0, canvasWidth, canvasHeight)
      const data = imageData.data
      const particles: Particle[] = []

      // Sample at pixel grid intervals
      const step = pixelSize + 1

      for (let y = 0; y < canvasHeight; y += step) {
        for (let x = 0; x < canvasWidth; x += step) {
          const i = (y * canvasWidth + x) * 4
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          // Calculate luminance
          const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255

          // The Istanbul map has:
          // - Black areas = Water (skip)
          // - Gray areas = Land with streets (create particles)
          // - White lines = Major roads (skip for contrast)
          
          // Create particles for gray land areas (luminance between 0.1 and 0.7)
          const isLand = luminance > 0.08 && luminance < 0.75

          if (isLand) {
            // Vary size based on luminance for texture
            const sizeVariation = 0.7 + luminance * 0.6
            const size = pixelSize * 0.4 * sizeVariation

            particles.push({
              x: x,
              y: y,
              baseX: x,
              baseY: y,
              size: size,
              phase: Math.random() * Math.PI * 2,
              speed: 0.5 + Math.random() * 1,
            })
          }
        }
      }

      return particles
    },
    [pixelSize]
  )

  const animate = useCallback(
    (time: number) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const width = canvas.width / dpr
      const height = canvas.height / dpr

      // Clear with background color
      ctx.fillStyle = colorBack
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw particles with brownian motion
      ctx.fillStyle = colorFront
      const timeSeconds = time * 0.001 * speed

      for (const particle of particlesRef.current) {
        // Organic brownian motion using multiple sine waves
        const wobbleX =
          Math.sin(timeSeconds * particle.speed + particle.phase) * 1.5 +
          Math.sin(timeSeconds * particle.speed * 0.7 + particle.phase * 1.3) * 0.8
        const wobbleY =
          Math.cos(timeSeconds * particle.speed * 0.9 + particle.phase * 0.8) * 1.5 +
          Math.cos(timeSeconds * particle.speed * 0.5 + particle.phase * 1.1) * 0.8

        const x = (particle.baseX + wobbleX) * dpr
        const y = (particle.baseY + wobbleY) * dpr
        const size = particle.size * dpr

        // Draw square pixel
        ctx.fillRect(x - size / 2, y - size / 2, size, size)
      }

      animationRef.current = requestAnimationFrame(animate)
    },
    [colorBack, colorFront, speed]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.scale(dpr, dpr)
    }

    // Load the map image
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = imageSrc

    img.onload = () => {
      particlesRef.current = extractParticlesFromImage(img, rect.width, rect.height)
      setIsLoaded(true)
      animationRef.current = requestAnimationFrame(animate)
    }

    img.onerror = () => {
      console.error("[v0] Failed to load map image:", imageSrc)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [imageSrc, extractParticlesFromImage, animate])

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr

      // Reload particles on resize
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = imageSrc
      img.onload = () => {
        particlesRef.current = extractParticlesFromImage(img, rect.width, rect.height)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [imageSrc, extractParticlesFromImage])

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ 
        width: "100%", 
        height: "100%",
        opacity: isLoaded ? 1 : 0,
        transition: "opacity 0.5s ease-in-out"
      }}
    />
  )
}
