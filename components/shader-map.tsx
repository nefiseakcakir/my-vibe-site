"use client"

import { useEffect, useRef, useState } from "react"

interface ShaderMapProps {
  imageSrc: string
  colorBack?: string
  colorFront?: string
  speed?: number
  pixelSize?: number
}

// Vertex shader
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`

// Fragment shader with animated noise masked by the map image
const fragmentShaderSource = `
  precision mediump float;
  
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  uniform float u_time;
  uniform vec3 u_colorBack;
  uniform vec3 u_colorFront;
  uniform float u_pixelSize;
  uniform vec2 u_resolution;
  
  // Simplex noise functions
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  // Bayer 8x8 dithering - using bit manipulation formula
  float bayer8x8(vec2 pos) {
    vec2 p = mod(pos, 8.0);
    float x = p.x;
    float y = p.y;
    
    // Compute bayer value using the interleaved bit pattern
    // This avoids nested loops with variable bounds
    float result = 0.0;
    float divisor = 2.0;
    float multiplier = 32.0;
    
    for(int i = 0; i < 3; i++) {
      float xBit = mod(floor(x / divisor), 2.0);
      float yBit = mod(floor(y / divisor), 2.0);
      result += (xBit + yBit - 2.0 * xBit * yBit) * multiplier;
      divisor *= 2.0;
      multiplier /= 4.0;
    }
    
    // Add the final bits
    float xBit0 = mod(x, 2.0);
    float yBit0 = mod(y, 2.0);
    result += (xBit0 + yBit0 - 2.0 * xBit0 * yBit0) * 32.0;
    
    return result / 64.0;
  }
  
  void main() {
    // Pixelate coordinates
    vec2 pixelCoord = floor(v_texCoord * u_resolution / u_pixelSize) * u_pixelSize / u_resolution;
    
    // Sample the map image
    vec4 mapColor = texture2D(u_image, pixelCoord);
    float luminance = dot(mapColor.rgb, vec3(0.299, 0.587, 0.114));
    
    // Determine if this is land (gray areas), water (black), or roads (white)
    // Land: 0.1 < luminance < 0.8
    // Water: luminance < 0.1
    // Roads: luminance > 0.8
    float isLand = step(0.08, luminance) * step(luminance, 0.75);
    float isWater = 1.0 - step(0.08, luminance);
    
    // Create subtle animated noise for land - slower and gentler movement
    vec2 noiseCoord = pixelCoord * 2.0;
    float noise1 = snoise(noiseCoord + u_time * 0.03);
    float noise2 = snoise(noiseCoord * 1.5 - u_time * 0.02);
    float noise3 = snoise(noiseCoord * 0.8 + u_time * 0.015);
    float combinedNoise = (noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2);
    
    // Normalize noise to 0-1 with gentler range
    float noiseValue = combinedNoise * 0.3 + 0.5;
    
    // Apply Bayer dithering
    vec2 ditherPos = floor(v_texCoord * u_resolution / u_pixelSize);
    float threshold = bayer8x8(ditherPos);
    
    // Combine noise with luminance for dithering decision - more stable
    float ditherValue = noiseValue * 0.4 + (1.0 - luminance) * 0.5 + 0.1;
    float showPixel = step(threshold * 0.6 + 0.2, ditherValue);
    
    // Only show pixels on land areas
    showPixel *= isLand;
    
    // === WATER EFFECTS ===
    // Thin horizontal wave lines rippling across the strait
    
    // Create multiple thin wave lines at different frequencies
    // Wave line 1 - fast moving, thin
    float waveY1 = pixelCoord.y * 80.0 + u_time * 2.5;
    float waveLine1 = smoothstep(0.0, 0.15, abs(fract(waveY1) - 0.5) - 0.35);
    
    // Wave line 2 - medium speed, offset
    float waveY2 = pixelCoord.y * 60.0 - u_time * 1.8 + pixelCoord.x * 3.0;
    float waveLine2 = smoothstep(0.0, 0.12, abs(fract(waveY2) - 0.5) - 0.38);
    
    // Wave line 3 - slower, different phase
    float waveY3 = pixelCoord.y * 100.0 + u_time * 3.2 - pixelCoord.x * 2.0;
    float waveLine3 = smoothstep(0.0, 0.1, abs(fract(waveY3) - 0.5) - 0.4);
    
    // Wave line 4 - crossing pattern
    float waveY4 = pixelCoord.y * 45.0 + u_time * 1.5 + sin(pixelCoord.x * 10.0) * 0.3;
    float waveLine4 = smoothstep(0.0, 0.15, abs(fract(waveY4) - 0.5) - 0.36);
    
    // Combine wave lines - they appear as thin horizontal ripples
    float waveLines = max(max(waveLine1, waveLine2), max(waveLine3, waveLine4));
    
    // Add subtle variation with noise to break up perfect lines
    float waveNoise = snoise(pixelCoord * 15.0 + vec2(u_time * 0.5, 0.0)) * 0.3;
    waveLines = waveLines * (0.7 + waveNoise * 0.3);
    
    // Apply Bayer dithering to wave lines for consistent pixel aesthetic
    float waterPixel = step(threshold * 0.5 + 0.25, waveLines * 0.8);
    waterPixel *= isWater * 0.7;
    
    // Final pixel combining land and water
    float finalPixel = max(showPixel, waterPixel);
    
    // Mix between background and foreground
    vec3 finalColor = mix(u_colorBack, u_colorFront, finalPixel);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
    ]
  }
  return [0, 0, 0]
}

export function ShaderMap({
  imageSrc,
  colorBack = "#F5F5DC",
  colorFront = "#36454F",
  speed = 1.0,
  pixelSize = 4,
}: ShaderMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  
  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        setDimensions({ 
          width: Math.floor(rect.width * dpr), 
          height: Math.floor(rect.height * dpr) 
        })
      }
    }
    
    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])
  
  // Initialize WebGL
  useEffect(() => {
    if (!canvasRef.current || dimensions.width === 0) return
    
    const canvas = canvasRef.current
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    
    const gl = canvas.getContext("webgl", { antialias: false })
    if (!gl) {
      console.error("[v0] WebGL not supported")
      return
    }
    glRef.current = gl
    
    // Create shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vertexShader, vertexShaderSource)
    gl.compileShader(vertexShader)
    
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error("[v0] Vertex shader error:", gl.getShaderInfoLog(vertexShader))
      return
    }
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fragmentShader, fragmentShaderSource)
    gl.compileShader(fragmentShader)
    
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error("[v0] Fragment shader error:", gl.getShaderInfoLog(fragmentShader))
      return
    }
    
    // Create program
    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("[v0] Program link error:", gl.getProgramInfoLog(program))
      return
    }
    
    programRef.current = program
    gl.useProgram(program)
    
    // Set up geometry (fullscreen quad)
    const positions = new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1, 1,   1, -1,   1, 1,
    ])
    const texCoords = new Float32Array([
      0, 1,  1, 1,  0, 0,
      0, 0,  1, 1,  1, 0,
    ])
    
    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
    
    const positionLocation = gl.getAttribLocation(program, "a_position")
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
    
    const texCoordBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW)
    
    const texCoordLocation = gl.getAttribLocation(program, "a_texCoord")
    gl.enableVertexAttribArray(texCoordLocation)
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)
    
    // Load image as texture
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => {
      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      
      // Set uniforms
      const colorBackRgb = hexToRgb(colorBack)
      const colorFrontRgb = hexToRgb(colorFront)
      
      gl.uniform3f(gl.getUniformLocation(program, "u_colorBack"), ...colorBackRgb)
      gl.uniform3f(gl.getUniformLocation(program, "u_colorFront"), ...colorFrontRgb)
      gl.uniform1f(gl.getUniformLocation(program, "u_pixelSize"), pixelSize)
      gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), dimensions.width, dimensions.height)
      
      // Start animation
      const startTime = performance.now()
      
      const animate = () => {
        const time = (performance.now() - startTime) / 1000 * speed
        gl.uniform1f(gl.getUniformLocation(program, "u_time"), time)
        
        gl.viewport(0, 0, dimensions.width, dimensions.height)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        
        animationRef.current = requestAnimationFrame(animate)
      }
      
      animate()
    }
    image.src = imageSrc
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [dimensions, imageSrc, colorBack, colorFront, speed, pixelSize])
  
  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ imageRendering: "pixelated" }}
    />
  )
}
