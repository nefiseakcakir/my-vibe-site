"use client"

import { useRef, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { Effect } from 'postprocessing'
import * as THREE from 'three'

// ─── Bayer 8×8 post-processing dither ────────────────────────────────────────
const retroFragmentShader = `
uniform sampler2D tDiffuse;
uniform float colorNum;
uniform float pixelSize;
uniform vec2 resolution;

float bayer8x8(vec2 p) {
  const float[64] matrix = float[64](
    0.0/64.0,  32.0/64.0, 8.0/64.0,  40.0/64.0, 2.0/64.0,  34.0/64.0, 10.0/64.0, 42.0/64.0,
    48.0/64.0, 16.0/64.0, 56.0/64.0, 24.0/64.0, 50.0/64.0, 18.0/64.0, 58.0/64.0, 26.0/64.0,
    12.0/64.0, 44.0/64.0, 4.0/64.0,  36.0/64.0, 14.0/64.0, 46.0/64.0, 6.0/64.0,  38.0/64.0,
    60.0/64.0, 28.0/64.0, 52.0/64.0, 20.0/64.0, 62.0/64.0, 30.0/64.0, 54.0/64.0, 22.0/64.0,
    3.0/64.0,  35.0/64.0, 11.0/64.0, 43.0/64.0, 1.0/64.0,  33.0/64.0, 9.0/64.0,  41.0/64.0,
    51.0/64.0, 19.0/64.0, 59.0/64.0, 27.0/64.0, 49.0/64.0, 17.0/64.0, 57.0/64.0, 25.0/64.0,
    15.0/64.0, 47.0/64.0, 7.0/64.0,  39.0/64.0, 13.0/64.0, 45.0/64.0, 5.0/64.0,  37.0/64.0,
    63.0/64.0, 31.0/64.0, 55.0/64.0, 23.0/64.0, 61.0/64.0, 29.0/64.0, 53.0/64.0, 21.0/64.0
  );
  int x = int(mod(p.x, 8.0));
  int y = int(mod(p.y, 8.0));
  return matrix[y * 8 + x];
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 pixelUv = floor(uv * resolution / pixelSize) * pixelSize / resolution;
  vec4 color = texture2D(tDiffuse, pixelUv);
  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  vec2 ditherPos = floor(uv * resolution / pixelSize);
  float threshold = bayer8x8(ditherPos);
  float levels = colorNum - 1.0;
  float dithered = floor(gray * levels + threshold) / levels;
  outputColor = vec4(vec3(dithered), 1.0);
}
`

class RetroEffectImpl extends Effect {
  constructor({ colorNum = 4, pixelSize = 2 } = {}) {
    super('RetroEffect', retroFragmentShader, {
      uniforms: new Map<string, THREE.Uniform<unknown>>([
        ['colorNum',   new THREE.Uniform(colorNum)],
        ['pixelSize',  new THREE.Uniform(pixelSize)],
        ['resolution', new THREE.Uniform(new THREE.Vector2(1, 1))]
      ])
    })
  }
  update(_renderer: THREE.WebGLRenderer, _inputBuffer: THREE.WebGLRenderTarget) {
    const r = this.uniforms.get('resolution')
    if (r && _inputBuffer) r.value.set(_inputBuffer.width, _inputBuffer.height)
  }
}

function RetroEffect({ colorNum = 4, pixelSize = 2 }: { colorNum?: number; pixelSize?: number }) {
  const effect = useMemo(() => new RetroEffectImpl({ colorNum, pixelSize }), [colorNum, pixelSize])
  return <primitive object={effect} />
}

// ─── Trail constants ──────────────────────────────────────────────────────────
const TRAIL_LEN   = 32   // number of trail points passed to the shader
const TRAIL_DECAY = 1800 // ms until a trail point fully fades

// ─── Main map fragment shader ─────────────────────────────────────────────────
const waveFragmentShader = `
precision highp float;
#define PI 3.14159265359
#define TRAIL_LEN 32

uniform vec2  resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3  waveColor;
uniform vec3  backgroundColor;
uniform vec3  trailColor;       // #324650 — highway highlight tint
uniform vec2  mousePos;
uniform int   enableMouseInteraction;
uniform float mouseRadius;
uniform sampler2D mapTexture;
uniform sampler2D mapTexture2;
uniform float mapTransition;
uniform int   useMapMask;

// ── Road-tracer trail ──────────────────────────────────────────────────────
uniform vec2  mouseTrail[TRAIL_LEN];
uniform float trailAlpha[TRAIL_LEN];

varying vec2 vUv;

// ── Perlin noise helpers ───────────────────────────────────────────────────
vec4 mod289(vec4 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }
vec2 fade(vec2 t2){ return t2*t2*t2*(t2*(t2*6.0-15.0)+10.0); }

float cnoise(vec2 P){
  vec4 Pi = floor(P.xyxy)+vec4(0,0,1,1);
  vec4 Pf = fract(P.xyxy)-vec4(0,0,1,1);
  Pi = mod289(Pi);
  vec4 ix=Pi.xzxz, iy=Pi.yyww, fx=Pf.xzxz, fy=Pf.yyww;
  vec4 i = permute(permute(ix)+iy);
  vec4 gx=fract(i*(1.0/41.0))*2.0-1.0, gy=abs(gx)-0.5;
  vec4 tx=floor(gx+0.5); gx=gx-tx;
  vec2 g00=vec2(gx.x,gy.x),g10=vec2(gx.y,gy.y),g01=vec2(gx.z,gy.z),g11=vec2(gx.w,gy.w);
  vec4 norm=taylorInvSqrt(vec4(dot(g00,g00),dot(g01,g01),dot(g10,g10),dot(g11,g11)));
  g00*=norm.x; g01*=norm.y; g10*=norm.z; g11*=norm.w;
  float n00=dot(g00,vec2(fx.x,fy.x)),n10=dot(g10,vec2(fx.y,fy.y));
  float n01=dot(g01,vec2(fx.z,fy.z)),n11=dot(g11,vec2(fx.w,fy.w));
  vec2 f=fade(Pf.xy);
  vec2 nx=mix(vec2(n00,n01),vec2(n10,n11),f.x);
  return mix(nx.x,nx.y,f.y);
}

float fbm(vec2 p){
  float v=0.0,a=0.5,f=1.0;
  for(int i=0;i<6;i++){v+=a*cnoise(p*f);a*=0.5;f*=2.0;}
  return v;
}

// ── 1. Idle breathing ─────────────────────────────────────────────────────
// Two slow noise fields give each region an independent shimmer phase.
// Dominant period ≈ 5 s; secondary ≈ 4 s. Total ≈ ±15% luminance jitter.
float idleJitter(vec2 uv){
  float ph1 = cnoise(uv*5.5 + vec2(time*0.11, time*0.07)) * PI*2.0;
  float ph2 = cnoise(uv*4.2 + vec2(time*0.09+1.7, time*0.13+3.1)) * PI*2.0;
  return sin(time*1.26 + ph1)*0.10 + sin(time*1.57 + ph2)*0.055;
}

// ── 2. Transition displacement ────────────────────────────────────────────
// sin(PI*t) peaks at midpoint → both maps displaced in different directions.
// Scale 0.016 ≈ 9 px on ~580 px canvas.
vec2 transitionDisplace(vec2 uv, float seed, float turb){
  float s = 0.016;
  float dx = cnoise(uv*7.0 + vec2(time*0.45+seed, 1.5+seed));
  float dy = cnoise(uv*7.0 + vec2(2.3+seed,       time*0.38+seed));
  return vec2(dx,dy)*turb*s;
}

// ── 3. Road-tracer glow ───────────────────────────────────────────────────
// Returns 0-1 proximity weight for pixels near the cursor trail.
// Radius is intentionally generous (~6% of canvas width) so the
// effect is felt even a few pixels away from a road line.
float trailProximity(vec2 uv, vec2 aspect){
  float w = 0.0;
  for(int i = 0; i < TRAIL_LEN; i++){
    if(trailAlpha[i] <= 0.0) continue;
    vec2 trailUv = mouseTrail[i] / resolution;
    float d = length((uv - trailUv) * aspect);
    // Wide halo so cursor doesn't need to be pixel-perfect on a road
    float halo = smoothstep(0.07, 0.0, d);
    // Tight core for the brightest part right at the cursor
    float core = smoothstep(0.018, 0.0, d) * 0.6;
    w += (halo + core) * trailAlpha[i];
  }
  return clamp(w, 0.0, 1.0);
}

void main(){
  vec2  uv     = vUv;
  vec2  aspect = vec2(resolution.x/resolution.y, 1.0);
  float t      = time * waveSpeed;

  if(useMapMask == 1){

    // Transition turbulence
    float turb  = sin(PI * mapTransition);
    vec2  disp1 = transitionDisplace(uv, 0.0, turb);
    vec2  disp2 = transitionDisplace(uv, 5.3, turb);
    vec2  uv1   = clamp(uv + disp1*(1.0-mapTransition), 0.0, 1.0);
    vec2  uv2   = clamp(uv + disp2*mapTransition,       0.0, 1.0);

    vec4 mc1 = texture2D(mapTexture,  uv1);
    vec4 mc2 = texture2D(mapTexture2, uv2);

    float eased = mapTransition < 0.5
      ? 2.0*mapTransition*mapTransition
      : 1.0 - pow(-2.0*mapTransition+2.0, 2.0)/2.0;
    vec4 mapColor = mix(mc1, mc2, eased);

    float mapLum = dot(mapColor.rgb, vec3(0.299, 0.587, 0.114));

    float isBlueRoad = step(0.15, mapColor.b) * step(mapColor.r+0.05, mapColor.b);
    float isRoad     = max(step(0.75, mapLum), isBlueRoad);
    // ── Major highways only: top ~10% of luminance = thickest white lines ──
    float isHighway  = max(step(0.90, mapLum), isBlueRoad);
    float isWater    = (1.0-step(0.08, mapLum))*(1.0-isBlueRoad);
    float isLand     = (1.0-isRoad)*(1.0-isWater);

    // Idle breathing
    float jitter     = idleJitter(uv);
    float roadValue  = clamp(0.86 + sin(time*0.35)*0.02 + jitter*0.5, 0.0, 1.0);
    float waterRippl = clamp(0.05 + sin(uv.y*38.0+t*2.2)*sin(uv.x*24.0-t*1.4)*0.028 + jitter*0.3, 0.0, 1.0);
    float landValue  = clamp(mapLum + jitter, 0.0, 1.0);

    float finalNoise = landValue*isLand + waterRippl*isWater + roadValue*isRoad;
    vec3  color      = mix(backgroundColor, waveColor, finalNoise);

    // ── Road-tracer: blend highway pixels toward trailColor (#324650) ──────
    // Roads that are NOT near the cursor stay cream (waveColor).
    // Roads that ARE near the cursor shift toward trailColor — a visible
    // dark-teal tint that reads as "the road darkening under the cursor".
    // Land/water are completely unaffected (isHighway = 0 there).
    if(enableMouseInteraction == 1){
      float prox = trailProximity(uv, aspect);
      // Clamp blend strength so the effect is clear but not cartoonish
      float blend = clamp(prox * isHighway, 0.0, 0.82);
      color = mix(color, trailColor, blend);
    }

    gl_FragColor = vec4(color, 1.0);

  } else {
    vec2  p     = uv * waveFrequency * aspect;
    float noise = fbm(p + vec2(t*0.5, t*0.3))*0.5 + 0.5;
    if(enableMouseInteraction == 1){
      vec2  mUv   = mousePos/resolution;
      float d     = length((uv-mUv)*aspect);
      noise      += smoothstep(mouseRadius, 0.0, d)*0.3*sin(d*20.0-t*3.0);
    }
    vec3 color = mix(backgroundColor, waveColor, noise);
    gl_FragColor = vec4(color, 1.0);
  }
}
`

const waveVertexShader = `
precision highp float;
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}
`

// ─── Trail sample type ────────────────────────────────────────────────────────
interface TrailPoint { x: number; y: number; t: number }

interface DitheredWavesProps {
  waveSpeed?: number
  waveFrequency?: number
  waveAmplitude?: number
  waveColor?: [number, number, number]
  backgroundColor?: [number, number, number]
  colorNum?: number
  pixelSize?: number
  disableAnimation?: boolean
  enableMouseInteraction?: boolean
  mouseRadius?: number
  mapTextureSrc?: string
  mapTextureSrc2?: string
  mapTextureSrc3?: string
  mapTextureSrc4?: string
  mapTextureSrc5?: string
  mapTextureSrc6?: string
  mapTextureSrc7?: string
  mapSwitchInterval?: number
  onMapChange?: (mapIndex: number) => void
  paused?: boolean
  advanceTrigger?: number
}

function DitheredWavesScene({
  waveSpeed = 0.05,
  waveFrequency = 3,
  waveAmplitude = 0.3,
  waveColor = [0.21, 0.27, 0.31],
  backgroundColor = [0.96, 0.96, 0.86],
  colorNum = 4,
  pixelSize = 2,
  disableAnimation = false,
  enableMouseInteraction = true,
  mouseRadius = 0.3,
  mapTextureSrc,
  mapTextureSrc2,
  mapTextureSrc3,
  mapTextureSrc4,
  mapTextureSrc5,
  mapTextureSrc6,
  mapTextureSrc7,
  mapSwitchInterval = 7000,
  onMapChange,
  paused = false,
  advanceTrigger = 0,
}: DitheredWavesProps) {
  const mesh = useRef<THREE.Mesh>(null)
  const { viewport, gl, size } = useThree()
  const mouseRef   = useRef(new THREE.Vector2(0, 0))
  const prevColor  = useRef([...waveColor])

  const mapTexture  = useRef<THREE.Texture | null>(null)
  const mapTexture2 = useRef<THREE.Texture | null>(null)
  const mapTexture3 = useRef<THREE.Texture | null>(null)
  const mapTexture4 = useRef<THREE.Texture | null>(null)
  const mapTexture5 = useRef<THREE.Texture | null>(null)
  const mapTexture6 = useRef<THREE.Texture | null>(null)
  const mapTexture7 = useRef<THREE.Texture | null>(null)

  const currentMapIndexRef = useRef(0)
  const lastSwitchTimeRef  = useRef(0)
  const shouldAdvanceRef   = useRef(false)

  // ── Trail buffer (raw, dense; downsampled to TRAIL_LEN for the shader) ──────
  const trailBufferRef = useRef<TrailPoint[]>([])
  const lastTrailTimeRef = useRef(0)

  useEffect(() => {
    if (advanceTrigger > 0) shouldAdvanceRef.current = true
  }, [advanceTrigger])

  // Load map textures
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    const load = (src: string | undefined, ref: React.MutableRefObject<THREE.Texture | null>) => {
      if (!src) return
      loader.load(src, (tex) => {
        tex.minFilter = THREE.LinearFilter
        tex.magFilter = THREE.LinearFilter
        ref.current = tex
      })
    }
    load(mapTextureSrc,  mapTexture)
    load(mapTextureSrc2, mapTexture2)
    load(mapTextureSrc3, mapTexture3)
    load(mapTextureSrc4, mapTexture4)
    load(mapTextureSrc5, mapTexture5)
    load(mapTextureSrc6, mapTexture6)
    load(mapTextureSrc7, mapTexture7)
  }, [mapTextureSrc, mapTextureSrc2, mapTextureSrc3, mapTextureSrc4,
      mapTextureSrc5, mapTextureSrc6, mapTextureSrc7])

  // Build flat arrays for the shader uniforms (re-used every frame, allocated once)
  const trailPosFlat = useMemo(() => new Float32Array(TRAIL_LEN * 2), [])
  const trailAlphaFlat = useMemo(() => new Float32Array(TRAIL_LEN), [])

  const waveUniforms = useMemo(() => {
    // Pre-build THREE.Vector2 array objects for the uniform
    const trailVecs = Array.from({ length: TRAIL_LEN }, () => new THREE.Vector2(0, 0))
    return {
      resolution:             { value: new THREE.Vector2(size.width, size.height) },
      time:                   { value: 0 },
      waveSpeed:              { value: waveSpeed },
      waveFrequency:          { value: waveFrequency },
      waveAmplitude:          { value: waveAmplitude },
      waveColor:              { value: new THREE.Vector3(...waveColor) },
      backgroundColor:        { value: new THREE.Vector3(...backgroundColor) },
      mousePos:               { value: new THREE.Vector2(0, 0) },
      enableMouseInteraction: { value: enableMouseInteraction ? 1 : 0 },
      mouseRadius:            { value: mouseRadius },
      mapTexture:             { value: null as THREE.Texture | null },
      mapTexture2:            { value: null as THREE.Texture | null },
      mapTransition:          { value: 0 },
      useMapMask:             { value: mapTextureSrc ? 1 : 0 },
      mouseTrail:             { value: trailVecs },
      trailAlpha:             { value: trailAlphaFlat },
      // #324650 → (50/255, 70/255, 80/255)
      trailColor:             { value: new THREE.Vector3(0.196, 0.275, 0.314) },
    }
  }, [])

  useEffect(() => {
    waveUniforms.resolution.value.set(size.width, size.height)
  }, [size, waveUniforms])

  useFrame((state) => {
    if (!mesh.current) return
    const material = mesh.current.material as THREE.ShaderMaterial
    const u = material.uniforms

    if (!disableAnimation) u.time.value = state.clock.elapsedTime

    u.waveSpeed.value     = waveSpeed
    u.waveFrequency.value = waveFrequency
    u.waveAmplitude.value = waveAmplitude

    if (!prevColor.current.every((v, i) => v === waveColor[i])) {
      u.waveColor.value.set(...waveColor)
      prevColor.current = [...waveColor]
    }
    u.backgroundColor.value.set(...backgroundColor)
    u.enableMouseInteraction.value = enableMouseInteraction ? 1 : 0
    u.mouseRadius.value            = mouseRadius
    if (enableMouseInteraction) u.mousePos.value.copy(mouseRef.current)

    // ── Trail: cull expired points, then write TRAIL_LEN newest to shader ──
    const now = performance.now()
    trailBufferRef.current = trailBufferRef.current.filter(
      (p) => now - p.t < TRAIL_DECAY
    )
    const buf = trailBufferRef.current
    const trailVecs = u.mouseTrail.value as THREE.Vector2[]
    const alphas    = u.trailAlpha.value  as number[]
    for (let i = 0; i < TRAIL_LEN; i++) {
      const idx = buf.length - 1 - i
      if (idx >= 0) {
        trailVecs[i].set(buf[idx].x, buf[idx].y)
        // Ease-out fade so older points are dimmer
        const rawAlpha = 1 - (now - buf[idx].t) / TRAIL_DECAY
        alphas[i] = rawAlpha * rawAlpha  // quadratic falloff
      } else {
        trailVecs[i].set(0, 0)
        alphas[i] = 0
      }
    }

    // ── Map texture assignment + transition ────────────────────────────────
    if (mapTexture.current) {
      u.mapTexture.value = mapTexture.current
      u.useMapMask.value = 1
    }

    const textures = [
      mapTexture.current, mapTexture2.current, mapTexture3.current,
      mapTexture4.current, mapTexture5.current, mapTexture6.current,
      mapTexture7.current,
    ]
    const numMaps = textures.filter(Boolean).length

    if (numMaps > 1) {
      const currentTime = state.clock.elapsedTime * 1000

      if (shouldAdvanceRef.current) {
        shouldAdvanceRef.current    = false
        currentMapIndexRef.current  = (currentMapIndexRef.current + 1) % numMaps
        lastSwitchTimeRef.current   = currentTime
        if (onMapChange) onMapChange(currentMapIndexRef.current)
      }

      const timeSinceSwitch = currentTime - lastSwitchTimeRef.current
      if (!paused && timeSinceSwitch > mapSwitchInterval) {
        lastSwitchTimeRef.current  = currentTime
        currentMapIndexRef.current = (currentMapIndexRef.current + 1) % numMaps
        if (onMapChange) onMapChange(currentMapIndexRef.current)
      }

      const progress = Math.min(timeSinceSwitch / 2000, 1)
      const eased    = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2

      const ci   = currentMapIndexRef.current
      const prev = (ci - 1 + numMaps) % numMaps
      u.mapTexture.value    = textures[prev]
      u.mapTexture2.value   = textures[ci]
      u.mapTransition.value = eased
    } else if (mapTexture.current) {
      u.mapTexture.value    = mapTexture.current
      u.mapTransition.value = 0
    }
  })

  // ── Pointer handler — push to trail buffer at ~40 ms intervals ────────────
  const handlePointerMove = (e: THREE.Event) => {
    const rect  = gl.domElement.getBoundingClientRect()
    const event = e as unknown as PointerEvent
    const x     = event.clientX - rect.left
    const y     = size.height - (event.clientY - rect.top) // flip Y to match GL coords

    // Always update raw mouse position (for the legacy circular ripple fallback)
    mouseRef.current.set(x, y)

    if (!enableMouseInteraction) return

    // Throttle trail samples — 20 ms gives smooth highway coverage
    const now = performance.now()
    if (now - lastTrailTimeRef.current > 20) {
      lastTrailTimeRef.current = now
      trailBufferRef.current.push({ x, y, t: now })
      // Keep the raw buffer bounded
      if (trailBufferRef.current.length > 200) {
        trailBufferRef.current.shift()
      }
    }
  }

  return (
    <>
      <mesh ref={mesh} scale={[viewport.width, viewport.height, 1]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          vertexShader={waveVertexShader}
          fragmentShader={waveFragmentShader}
          uniforms={waveUniforms}
        />
      </mesh>

      <EffectComposer>
        <RetroEffect colorNum={colorNum} pixelSize={pixelSize} />
      </EffectComposer>

      {/* Invisible hit mesh that captures pointer events */}
      <mesh
        onPointerMove={handlePointerMove}
        position={[0, 0, 0.01]}
        scale={[viewport.width, viewport.height, 1]}
        visible={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  )
}

interface DitherMapProps {
  waveSpeed?: number
  waveFrequency?: number
  waveAmplitude?: number
  waveColor?: [number, number, number]
  backgroundColor?: [number, number, number]
  colorNum?: number
  pixelSize?: number
  disableAnimation?: boolean
  enableMouseInteraction?: boolean
  mouseRadius?: number
  mapTextureSrc?: string
  mapTextureSrc2?: string
  mapTextureSrc3?: string
  mapTextureSrc4?: string
  mapTextureSrc5?: string
  mapTextureSrc6?: string
  mapTextureSrc7?: string
  mapSwitchInterval?: number
  onMapChange?: (mapIndex: number) => void
  paused?: boolean
  advanceTrigger?: number
  className?: string
}

export default function DitherMap({
  waveSpeed = 0.05,
  waveFrequency = 3,
  waveAmplitude = 0.3,
  waveColor = [0.21, 0.27, 0.31],
  backgroundColor = [0.96, 0.96, 0.86],
  colorNum = 4,
  pixelSize = 2,
  disableAnimation = false,
  enableMouseInteraction = true,
  mouseRadius = 0.3,
  mapTextureSrc,
  mapTextureSrc2,
  mapTextureSrc3,
  mapTextureSrc4,
  mapTextureSrc5,
  mapTextureSrc6,
  mapTextureSrc7,
  mapSwitchInterval = 7000,
  onMapChange,
  paused = false,
  advanceTrigger = 0,
  className = "",
}: DitherMapProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 1] }}
        dpr={1}
        gl={{ antialias: false, alpha: true, preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <DitheredWavesScene
            waveSpeed={waveSpeed}
            waveFrequency={waveFrequency}
            waveAmplitude={waveAmplitude}
            waveColor={waveColor}
            backgroundColor={backgroundColor}
            colorNum={colorNum}
            pixelSize={pixelSize}
            disableAnimation={disableAnimation}
            enableMouseInteraction={enableMouseInteraction}
            mouseRadius={mouseRadius}
            mapTextureSrc={mapTextureSrc}
            mapTextureSrc2={mapTextureSrc2}
            mapTextureSrc3={mapTextureSrc3}
            mapTextureSrc4={mapTextureSrc4}
            mapTextureSrc5={mapTextureSrc5}
            mapTextureSrc6={mapTextureSrc6}
            mapTextureSrc7={mapTextureSrc7}
            mapSwitchInterval={mapSwitchInterval}
            paused={paused}
            advanceTrigger={advanceTrigger}
            onMapChange={onMapChange}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
