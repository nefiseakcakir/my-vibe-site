# Shader Build — Task Tracker

## Foundation
- [x] Create `components/ShaderBackground.tsx` with `'use client'` boundary
- [x] Install and verify `@paper-design/shaders-react` imports compile (Dithering, ImageDithering)
- [x] Define `CITY_IMAGES` map and `currentMap` prop interface
- [x] Delete `components/ParticleCanvas.tsx`
- [x] Update `app/page.tsx`: swap ParticleCanvas → ShaderBackground

## Bosphorus-Centered Grid & Map Source
- [x] Confirm `/public/istanbul-map.png` exists and is correct aspect ratio
- [x] Set `ImageDithering` props: `type="8x8"`, `size=3`, `colorFront="#36454F"`, `colorBack="#F5F5DC"`
- [ ] Verify map fills viewport correctly with `width="100%" height="100%"` + `fit="cover"`

## Image Pre-loader
- [x] Implement `preloadImages(paths)` utility (new Image() per path, no state)
- [x] Call `preloadImages(Object.values(CITY_IMAGES))` in mount effect before reveal timer
- [ ] Test: throttle network to Slow 3G, confirm no texture-load flash during transition

## Materialization Animation
- [x] Mount `<Dithering shape="simplex" type="random">` as Layer A (noise)
- [x] Mount `<ImageDithering>` as Layer B (map), `opacity: 0`
- [x] `useState(false)` → `setRevealed(true)` after 50ms → CSS `transition: opacity 5s ease-in-out`
- [ ] Verify: noise visible ~5s, Istanbul map materializes cleanly

## Cursor Deflection
- [x] Add `<canvas>` overlay ref, `position: absolute`, `pointerEvents: none`
- [x] Resize handler: `canvas.width/height = window.innerWidth/Height` on mount + resize event
- [x] `mousemove` listener on container div → update `mouse.x/y` ref, set `splash = 1`, start 80ms timeout
- [x] rAF loop: decay `splash` by 0.018/frame when cursor still; clearRect; draw radial cream gradient
- [ ] Test: dots clear under cursor, re-ink over ~900ms after cursor stops

## Mobile Ambient Float
- [x] Detect mobile: `isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0` (ref, not state)
- [x] In rAF loop: replace `mouse.x/y` with Lissajous formula when `isMobile.current`
- [x] Cap `effectiveSplash = 0.35` on mobile (subtle glow, not full wipe)
- [ ] Test on iOS Safari / Chrome Android: gentle oval drift visible, no cursor artifacts

## Smooth City Transitions (currentMap prop)
- [x] `useState<{src:string,id:number}[]>` for layer array; `useState<number>` for activeId
- [x] `useEffect([currentMap])`: append new layer, set activeId, cleanup old layer after 1200ms
- [x] Each layer: `opacity: layer.id === activeId && revealed ? 1 : 0`, `transition: opacity 1.2s`
- [ ] Test: pass two different map paths in quick succession — no flash, clean crossfade

## Sidebar Navigation (future)
- [ ] Design sidebar component spec (fixed left, city list, active state)
- [ ] Wire sidebar city selection → `currentMap` prop on ShaderBackground
- [ ] Keyboard navigation (arrow keys cycle cities)
- [ ] Mobile: bottom nav strip instead of sidebar

## Polish & Performance
- [ ] Confirm no React re-renders during rAF loop (use React DevTools Profiler)
- [ ] Verify `z-index` stack: ShaderBackground (0) → main text (10) → StoryPopup (50/60)
- [ ] Check high-DPI: canvas overlay uses `window.devicePixelRatio` if blur is noticeable
- [ ] Lighthouse performance score ≥ 90 with shader running
- [ ] Cross-browser: Chrome, Safari, Firefox — WebGL context creation check
