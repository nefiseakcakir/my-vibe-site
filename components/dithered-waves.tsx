"use client"

import { useEffect, useRef, useState } from "react"

interface DitheredWavesProps {
  colorLight?: string
  colorDark?: string
  speed?: number
  pixelSize?: number
  complexity?: number
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

// Fragment shader - fluid dithered waves like Maxime Heckel's effect
const fragmentShaderSource = `
  precision highp float;
  
  varying vec2 v_texCoord;
  uniform float u_time;
  uniform vec3 u_colorLight;
  uniform vec3 u_colorDark;
  uniform float u_pixelSize;
  uniform vec2 u_resolution;
  uniform float u_complexity;
  
  // Simplex noise
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
  
  // Fractal Brownian Motion for organic fluid look
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for(int i = 0; i < 6; i++) {
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }
  
  // Domain warping for that fluid, marble-like effect
  float warpedFbm(vec2 p, float time) {
    vec2 q = vec2(
      fbm(p + vec2(0.0, 0.0) + time * 0.1),
      fbm(p + vec2(5.2, 1.3) + time * 0.12)
    );
    
    vec2 r = vec2(
      fbm(p + u_complexity * q + vec2(1.7, 9.2) + time * 0.15),
      fbm(p + u_complexity * q + vec2(8.3, 2.8) + time * 0.13)
    );
    
    return fbm(p + u_complexity * r);
  }
  
  // Bayer 8x8 dithering
  float bayer8x8(vec2 pos) {
    vec2 p = mod(pos, 8.0);
    float x = p.x;
    float y = p.y;
    
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
    
    float xBit0 = mod(x, 2.0);
    float yBit0 = mod(y, 2.0);
    result += (xBit0 + yBit0 - 2.0 * xBit0 * yBit0) * 32.0;
    
    return result / 64.0;
  }
  
  void main() {
    // Pixelate coordinates
    vec2 pixelCoord = floor(v_texCoord * u_resolution / u_pixelSize) * u_pixelSize / u_resolution;
    
    // Create fluid warped noise pattern
    vec2 uv = pixelCoord * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;
    
    // Multiple layers of warped noise for depth
    float noise1 = warpedFbm(uv * 0.8, u_time);
    float noise2 = warpedFbm(uv * 1.2 + vec2(100.0), u_time * 0.8);
    float noise3 = fbm(uv * 2.0 + u_time * 0.05);
    
    // Combine for rich grayscale variation
    float combinedNoise = noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2;
    
    // Normalize to 0-1 range with good spread
    float value = combinedNoise * 0.4 + 0.5;
    value = clamp(value, 0.0, 1.0);
    
    // Apply Bayer dithering for that halftone look
    vec2 ditherPos = floor(v_texCoord * u_resolution / u_pixelSize);
    float threshold = bayer8x8(ditherPos);
    
    // Create multiple gray levels through dithering
    // This creates the rich grayscale gradient effect
    float ditheredValue = step(threshold, value);
    
    // Add some intermediate tones for richer gradients
    float midTone1 = step(threshold * 0.5, value) * step(value, threshold * 1.5) * 0.3;
    float midTone2 = step(threshold * 0.7, value) * step(value, threshold * 1.3) * 0.5;
    
    float finalValue = ditheredValue + midTone1 + midTone2;
    finalValue = clamp(finalValue, 0.0, 1.0);
    
    // Mix between dark and light colors
    vec3 finalColor = mix(u_colorDark, u_colorLight, finalValue);
    
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

export function DitheredWaves({
  colorLight = "#E8E8E8",
  colorDark = "#1a1a1a",
  speed = 0.3,
  pixelSize = 3,
  complexity = 4.0,
}: DitheredWavesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  
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
  
  useEffect(() => {
    if (!canvasRef.current || dimensions.width === 0) return
    
    const canvas = canvasRef.current
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    
    const gl = canvas.getContext("webgl", { antialias: false })
    if (!gl) return
    
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
    
    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("[v0] Program link error:", gl.getProgramInfoLog(program))
      return
    }
    
    gl.useProgram(program)
    
    // Set up geometry
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
    
    // Set uniforms
    const colorLightRgb = hexToRgb(colorLight)
    const colorDarkRgb = hexToRgb(colorDark)
    
    gl.uniform3f(gl.getUniformLocation(program, "u_colorLight"), ...colorLightRgb)
    gl.uniform3f(gl.getUniformLocation(program, "u_colorDark"), ...colorDarkRgb)
    gl.uniform1f(gl.getUniformLocation(program, "u_pixelSize"), pixelSize)
    gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), dimensions.width, dimensions.height)
    gl.uniform1f(gl.getUniformLocation(program, "u_complexity"), complexity)
    
    const startTime = performance.now()
    
    const animate = () => {
      const time = (performance.now() - startTime) / 1000 * speed
      gl.uniform1f(gl.getUniformLocation(program, "u_time"), time)
      
      gl.viewport(0, 0, dimensions.width, dimensions.height)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animate()
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [dimensions, colorLight, colorDark, speed, pixelSize, complexity])
  
  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ imageRendering: "pixelated" }}
    />
  )
}
