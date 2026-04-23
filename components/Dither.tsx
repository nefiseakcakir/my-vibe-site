/* eslint-disable react/no-unknown-property */
'use client'

import { useRef, useEffect, forwardRef, Suspense } from 'react'
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber'
import { EffectComposer, wrapEffect } from '@react-three/postprocessing'
import { Effect } from 'postprocessing'
import * as THREE from 'three'

import './Dither.css'

// ── Wave vertex shader ────────────────────────────────────────────────────────
const waveVertexShader = `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  vec4 viewPosition  = viewMatrix * modelPosition;
  gl_Position = projectionMatrix * viewPosition;
}
`

// ── Wave fragment shader — FBM noise masked by Istanbul map ───────────────────
// The Istanbul map texture defines where the effect renders:
//   dark pixels  → Istanbul land → show animated wave
//   light pixels → Bosphorus / sea → show cream background
const waveFragmentShader = `
precision highp float;

uniform vec2      resolution;
uniform float     time;
uniform float     waveSpeed;
uniform float     waveFrequency;
uniform float     waveAmplitude;
uniform vec3      waveColor;
uniform vec2      mousePos;
uniform int       enableMouseInteraction;
uniform float     mouseRadius;
uniform sampler2D istanbulMap;   // Istanbul shape mask
uniform vec3      colorBack;     // background color (cream)

// ── Perlin noise helpers ──────────────────────────────────────────────────────
vec4 mod289v4(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x)  { return mod289v4(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod289v4(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i  = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2  fade_xy = fade(Pf.xy);
  vec2  n_x     = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

// ── Fractional Brownian Motion (FBM) ─────────────────────────────────────────
const int OCTAVES = 4;
float fbm(vec2 p) {
  float value = 0.0;
  float amp   = 1.0;
  float freq  = waveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p     *= freq;
    amp   *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - time * waveSpeed;
  return fbm(p + fbm(p2));
}

void main() {
  // Raw screen UV (0→1) — used for map texture lookup
  vec2 rawUV = gl_FragCoord.xy / resolution.xy;

  // Istanbul map mask: dark pixels = land (mask→1), light pixels = sea (mask→0)
  // Flip Y because WebGL origin is bottom-left, image origin is top-left
  vec4  mapSample  = texture2D(istanbulMap, vec2(rawUV.x, 1.0 - rawUV.y));
  float luminance  = dot(mapSample.rgb, vec3(0.299, 0.587, 0.114));
  float istanbulMask = 1.0 - smoothstep(0.35, 0.65, luminance);

  // Aspect-corrected, centered UV for wave computation
  vec2 uv = rawUV - 0.5;
  uv.x *= resolution.x / resolution.y;

  float f = pattern(uv);

  // Mouse interaction: cursor digs a hollow into the wave
  if (enableMouseInteraction == 1) {
    vec2 mouseNDC = (mousePos / resolution - 0.5) * vec2(1.0, -1.0);
    mouseNDC.x   *= resolution.x / resolution.y;
    float dist    = length(uv - mouseNDC);
    float effect  = 1.0 - smoothstep(0.0, mouseRadius, dist);
    f -= 0.5 * effect;
  }

  // Wave color on land, background color on sea
  vec3 waveCol = mix(vec3(0.0), waveColor, f);
  vec3 col     = mix(colorBack, waveCol, istanbulMask);

  gl_FragColor = vec4(col, 1.0);
}
`

// ── Bayer 8×8 dithering post-process effect ───────────────────────────────────
const ditherFragmentShader = `
precision highp float;

uniform float colorNum;
uniform float pixelSize;

const float bayerMatrix8x8[64] = float[64](
   0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0,  3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
  32.0/64.0, 16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0, 19.0/64.0, 47.0/64.0, 31.0/64.0,
   8.0/64.0, 56.0/64.0,  4.0/64.0, 52.0/64.0, 11.0/64.0, 59.0/64.0,  7.0/64.0, 55.0/64.0,
  40.0/64.0, 24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0, 27.0/64.0, 39.0/64.0, 23.0/64.0,
   2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0,  1.0/64.0, 49.0/64.0, 13.0/64.0, 61.0/64.0,
  34.0/64.0, 18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0, 17.0/64.0, 45.0/64.0, 29.0/64.0,
  10.0/64.0, 58.0/64.0,  6.0/64.0, 54.0/64.0,  9.0/64.0, 57.0/64.0,  5.0/64.0, 53.0/64.0,
  42.0/64.0, 26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0, 25.0/64.0, 37.0/64.0, 21.0/64.0
);

vec3 dither(vec2 uv, vec3 color) {
  vec2  scaledCoord = floor(uv * resolution / pixelSize);
  int   x           = int(mod(scaledCoord.x, 8.0));
  int   y           = int(mod(scaledCoord.y, 8.0));
  float threshold   = bayerMatrix8x8[y * 8 + x] - 0.25;
  float step        = 1.0 / (colorNum - 1.0);
  color  += threshold * step;
  float bias = 0.2;
  color  = clamp(color - bias, 0.0, 1.0);
  return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
}

void mainImage(in vec4 inputColor, in vec2 uv, out vec4 outputColor) {
  vec2 normalizedPixelSize = pixelSize / resolution;
  vec2 uvPixel  = normalizedPixelSize * floor(uv / normalizedPixelSize);
  vec4 color    = texture2D(inputBuffer, uvPixel);
  color.rgb     = dither(uv, color.rgb);
  outputColor   = color;
}
`

// ── Postprocessing effect class ───────────────────────────────────────────────
class RetroEffectImpl extends Effect {
  declare uniforms: Map<string, THREE.Uniform<number>>

  constructor() {
    const uniforms = new Map<string, THREE.Uniform<number>>([
      ['colorNum',  new THREE.Uniform(4.0)],
      ['pixelSize', new THREE.Uniform(2.0)],
    ])
    super('RetroEffect', ditherFragmentShader, { uniforms })
    this.uniforms = uniforms
  }

  get colorNum()       { return this.uniforms.get('colorNum')!.value }
  set colorNum(v)      { this.uniforms.get('colorNum')!.value = v }
  get pixelSize()      { return this.uniforms.get('pixelSize')!.value }
  set pixelSize(v)     { this.uniforms.get('pixelSize')!.value = v }
}

const WrappedRetro = wrapEffect(RetroEffectImpl)

interface RetroEffectProps {
  colorNum?: number
  pixelSize?: number
}

const RetroEffect = forwardRef<RetroEffectImpl, RetroEffectProps>(
  ({ colorNum, pixelSize }, ref) => (
    <WrappedRetro ref={ref} colorNum={colorNum} pixelSize={pixelSize} />
  ),
)
RetroEffect.displayName = 'RetroEffect'

// ── Inner scene (must live inside Canvas so hooks work) ───────────────────────
interface DitheredWavesProps {
  waveSpeed:              number
  waveFrequency:          number
  waveAmplitude:          number
  waveColor:              [number, number, number]
  colorBack:              [number, number, number]
  colorNum:               number
  pixelSize:              number
  disableAnimation:       boolean
  enableMouseInteraction: boolean
  mouseRadius:            number
  mapTexture:             THREE.Texture
}

function DitheredWaves({
  waveSpeed, waveFrequency, waveAmplitude,
  waveColor, colorBack,
  colorNum, pixelSize,
  disableAnimation, enableMouseInteraction, mouseRadius,
  mapTexture,
}: DitheredWavesProps) {
  const mouseRef    = useRef(new THREE.Vector2())
  const prevColor   = useRef([...waveColor])
  const { viewport, size, gl } = useThree()

  const waveUniformsRef = useRef({
    time:                   new THREE.Uniform(0),
    resolution:             new THREE.Uniform(new THREE.Vector2(0, 0)),
    waveSpeed:              new THREE.Uniform(waveSpeed),
    waveFrequency:          new THREE.Uniform(waveFrequency),
    waveAmplitude:          new THREE.Uniform(waveAmplitude),
    waveColor:              new THREE.Uniform(new THREE.Color(...waveColor)),
    colorBack:              new THREE.Uniform(new THREE.Color(...colorBack)),
    mousePos:               new THREE.Uniform(new THREE.Vector2(0, 0)),
    enableMouseInteraction: new THREE.Uniform(enableMouseInteraction ? 1 : 0),
    mouseRadius:            new THREE.Uniform(mouseRadius),
    istanbulMap:            new THREE.Uniform(mapTexture),
  })

  // Keep resolution in sync with canvas size
  useEffect(() => {
    const dpr = gl.getPixelRatio()
    const w   = Math.floor(size.width  * dpr)
    const h   = Math.floor(size.height * dpr)
    waveUniformsRef.current.resolution.value.set(w, h)
  }, [size, gl])

  // Update map texture when it changes
  useEffect(() => {
    waveUniformsRef.current.istanbulMap.value = mapTexture
  }, [mapTexture])

  useFrame(({ clock }) => {
    const u = waveUniformsRef.current

    if (!disableAnimation) u.time.value = clock.getElapsedTime()

    if (u.waveSpeed.value     !== waveSpeed)     u.waveSpeed.value     = waveSpeed
    if (u.waveFrequency.value !== waveFrequency) u.waveFrequency.value = waveFrequency
    if (u.waveAmplitude.value !== waveAmplitude) u.waveAmplitude.value = waveAmplitude

    if (!prevColor.current.every((v, i) => v === waveColor[i])) {
      u.waveColor.value.set(...waveColor)
      prevColor.current = [...waveColor]
    }

    u.enableMouseInteraction.value = enableMouseInteraction ? 1 : 0
    u.mouseRadius.value            = mouseRadius
    if (enableMouseInteraction) u.mousePos.value.copy(mouseRef.current)
  })

  const handlePointerMove = (e: { clientX: number; clientY: number }) => {
    if (!enableMouseInteraction) return
    const rect = gl.domElement.getBoundingClientRect()
    const dpr  = gl.getPixelRatio()
    mouseRef.current.set(
      (e.clientX - rect.left) * dpr,
      (e.clientY - rect.top)  * dpr,
    )
  }

  return (
    <>
      {/* Wave plane */}
      <mesh scale={[viewport.width, viewport.height, 1]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          vertexShader={waveVertexShader}
          fragmentShader={waveFragmentShader}
          uniforms={waveUniformsRef.current}
        />
      </mesh>

      {/* Bayer dithering post-process */}
      <EffectComposer>
        <RetroEffect colorNum={colorNum} pixelSize={pixelSize} />
      </EffectComposer>

      {/* Invisible hit mesh for mouse tracking */}
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

// Loads the texture then renders DitheredWaves (useLoader needs Suspense)
function DitheredWavesLoader(props: Omit<DitheredWavesProps, 'mapTexture'> & { mapSrc: string }) {
  const mapTexture = useLoader(THREE.TextureLoader, props.mapSrc)
  return <DitheredWaves {...props} mapTexture={mapTexture} />
}

// ── Public component ──────────────────────────────────────────────────────────
export interface DitherProps {
  /** Path to the map PNG that shapes the effect (dark = active, light = background) */
  mapSrc?:                string
  waveColor?:             [number, number, number]
  /** Background color as [r, g, b] 0–1 floats — shown outside the map shape */
  colorBack?:             [number, number, number]
  disableAnimation?:      boolean
  enableMouseInteraction?: boolean
  mouseRadius?:           number
  colorNum?:              number
  pixelSize?:             number
  waveAmplitude?:         number
  waveFrequency?:         number
  waveSpeed?:             number
}

export default function Dither({
  mapSrc                = '/istanbul-map.png',
  waveColor             = [0.212, 0.271, 0.310],  // #36454F charcoal
  colorBack             = [0.961, 0.961, 0.863],  // #F5F5DC cream
  disableAnimation      = false,
  enableMouseInteraction = true,
  mouseRadius           = 0.3,
  colorNum              = 4,
  pixelSize             = 2,
  waveAmplitude         = 0.3,
  waveFrequency         = 3,
  waveSpeed             = 0.05,
}: DitherProps) {
  return (
    <Canvas
      className="dither-container"
      camera={{ position: [0, 0, 6] }}
      dpr={1}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <Suspense fallback={null}>
        <DitheredWavesLoader
          mapSrc={mapSrc}
          waveColor={waveColor}
          colorBack={colorBack}
          waveSpeed={waveSpeed}
          waveFrequency={waveFrequency}
          waveAmplitude={waveAmplitude}
          colorNum={colorNum}
          pixelSize={pixelSize}
          disableAnimation={disableAnimation}
          enableMouseInteraction={enableMouseInteraction}
          mouseRadius={mouseRadius}
        />
      </Suspense>
    </Canvas>
  )
}
