# Research: React Bits "Gradient Blinds" — Official Source (TS-default, plain CSS)

- **Query**: Find the EXACT, current official source of React Bits "Gradient Blinds" (default JS/TS, NON-Tailwind, plain CSS; TS preferred) for faithful implementation in Vite + React 19 + TS strict.
- **Scope**: external
- **Date**: 2026-06-01
- **Variant fetched**: `ts-default` (TypeScript + plain CSS), the requested NON-Tailwind variant.

## Source URLs Used

- Component (TS, plain CSS): `https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Backgrounds/GradientBlinds/GradientBlinds.tsx`
- CSS: `https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Backgrounds/GradientBlinds/GradientBlinds.css`
- Repo `package.json` (for `ogl` version): `https://github.com/DavidHDev/react-bits/blob/main/package.json`
- Website: `https://reactbits.dev/backgrounds/gradient-blinds`
- Fetched verbatim via the GitHub Contents API with `Accept: application/vnd.github.raw` on `ref=main`. (Note: `raw.githubusercontent.com` was network-blocked in this environment; `api.github.com` worked, so contents are byte-for-byte from the API.)

> Other available variants in the repo (not used): `src/content/.../GradientBlinds.jsx` (JS+CSS), `src/tailwind/...`, `src/ts-tailwind/...`, plus registry JSON `public/r/GradientBlinds-TS-CSS.json`.

## Dependency

- Runtime dependency: **`ogl`** (confirmed — imported as `import { Renderer, Program, Mesh, Triangle } from 'ogl';`).
- Version pinned in React Bits repo `package.json`: **`"ogl": "^1.0.11"`**
- Install command:

```bash
npm install ogl
# or pin to match React Bits: npm install ogl@^1.0.11
```

- `react` / `react-dom` are peer deps already in your app (component imports `React, { useEffect, useRef }`).

## Props (verbatim from `GradientBlindsProps` + defaults from destructuring)

| Name | Type | Default |
|---|---|---|
| `className` | `string` | `undefined` (rendered as `` `gradient-blinds-container ${className}` `` — note: produces literal `"undefined"` suffix if omitted) |
| `dpr` | `number` | `undefined` → falls back to `window.devicePixelRatio || 1` |
| `paused` | `boolean` | `false` |
| `gradientColors` | `string[]` | `undefined` → defaults to `['#FF9FFC', '#5227FF']` |
| `angle` | `number` (degrees) | `0` |
| `noise` | `number` | `0.3` |
| `blindCount` | `number` | `16` |
| `blindMinWidth` | `number` (px) | `60` |
| `mouseDampening` | `number` (seconds, time-constant) | `0.15` |
| `mirrorGradient` | `boolean` | `false` |
| `spotlightRadius` | `number` | `0.5` |
| `spotlightSoftness` | `number` | `1` |
| `spotlightOpacity` | `number` | `1` |
| `distortAmount` | `number` | `0` |
| `shineDirection` | `'left' \| 'right'` | `'left'` |
| `mixBlendMode` | `string` | `'lighten'` |

Notes from source:
- Color handling: up to `MAX_COLORS = 8` stops; single color is duplicated; fewer than 8 are padded by repeating the last. `gradientColors.length` (clamped 2..8) drives `uColorCount`.
- `blindMinWidth` caps blind count by container width: `effective = min(blindCount, floor(width / blindMinWidth))`.
- `angle` is converted degrees→radians: `uAngle = angle * Math.PI / 180`.

## Shipped CSS (`GradientBlinds.css`, verbatim — 104 bytes)

```css
.gradient-blinds-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
```

The component imports it directly: `import './GradientBlinds.css';`. Container fills its parent (100% / 100%), so the parent must define size.

## Cleanup / React 19 + StrictMode Notes

The single `useEffect` does full setup and returns a teardown function. StrictMode in dev mounts→unmounts→remounts, so the teardown must fully release resources; the source handles this:

- **rAF loop**: `rafRef` stores the `requestAnimationFrame` id; teardown calls `cancelAnimationFrame(rafRef.current)`.
- **Event listener**: `canvas.addEventListener('pointermove', onPointerMove)` is removed in teardown via `canvas.removeEventListener('pointermove', onPointerMove)`.
- **ResizeObserver**: `ro = new ResizeObserver(resize)` observing `container`; teardown calls `ro.disconnect()`.
- **DOM**: canvas appended via `container.appendChild(canvas)`; teardown removes it only if still attached: `if (canvas.parentElement === container) container.removeChild(canvas)`.
- **WebGL / OGL objects**: teardown defensively calls `.remove()` on `program`, `geometry`, `mesh` and `.destroy()` on `renderer` (via a `callIfFn` helper that checks `typeof === 'function'`), then nulls all refs (`programRef/geometryRef/meshRef/rendererRef = null`).
- **Effect deps**: the dep array lists all visual props EXCEPT `mixBlendMode` (applied via inline style on the div, no GL re-init) and `className`. Changing any listed prop tears down and rebuilds the whole WebGL context.

StrictMode caveats to watch when implementing:
- Because deps include `gradientColors` (an array) and other object/array props, passing inline literals will re-run the full teardown/setup on every render. Memoize (`useMemo`) array props upstream to avoid churn.
- The double-invoke in dev exercises the teardown path immediately; the code's guarded removal (`canvas.parentElement === container`) and null-checks make it StrictMode-safe. No `destroy`/context-loss errors expected on remount.
- `className` interpolation yields `"gradient-blinds-container undefined"` when `className` is not passed — harmless but consider supplying a value or trimming.

## Full Component Source (`GradientBlinds.tsx`, verbatim)

```tsx
import React, { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';
import './GradientBlinds.css';

export interface GradientBlindsProps {
  className?: string;
  dpr?: number;
  paused?: boolean;
  gradientColors?: string[];
  angle?: number;
  noise?: number;
  blindCount?: number;
  blindMinWidth?: number;
  mouseDampening?: number;
  mirrorGradient?: boolean;
  spotlightRadius?: number;
  spotlightSoftness?: number;
  spotlightOpacity?: number;
  distortAmount?: number;
  shineDirection?: 'left' | 'right';
  mixBlendMode?: string;
}

const MAX_COLORS = 8;
const hexToRGB = (hex: string): [number, number, number] => {
  const c = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return [r, g, b];
};
const prepStops = (stops?: string[]) => {
  const base = (stops && stops.length ? stops : ['#FF9FFC', '#5227FF']).slice(0, MAX_COLORS);
  if (base.length === 1) base.push(base[0]);
  while (base.length < MAX_COLORS) base.push(base[base.length - 1]);
  const arr: [number, number, number][] = [];
  for (let i = 0; i < MAX_COLORS; i++) arr.push(hexToRGB(base[i]));
  const count = Math.max(2, Math.min(MAX_COLORS, stops?.length ?? 2));
  return { arr, count };
};

const GradientBlinds: React.FC<GradientBlindsProps> = ({
  className,
  dpr,
  paused = false,
  gradientColors,
  angle = 0,
  noise = 0.3,
  blindCount = 16,
  blindMinWidth = 60,
  mouseDampening = 0.15,
  mirrorGradient = false,
  spotlightRadius = 0.5,
  spotlightSoftness = 1,
  spotlightOpacity = 1,
  distortAmount = 0,
  shineDirection = 'left',
  mixBlendMode = 'lighten'
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const programRef = useRef<Program | null>(null);
  const meshRef = useRef<Mesh<Triangle> | null>(null);
  const geometryRef = useRef<Triangle | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const mouseTargetRef = useRef<[number, number]>([0, 0]);
  const lastTimeRef = useRef<number>(0);
  const firstResizeRef = useRef<boolean>(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({
      dpr: dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
      alpha: true,
      antialias: true
    });
    rendererRef.current = renderer;
    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;

    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const vertex = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

    const fragment = `
#ifdef GL_ES
precision mediump float;
#endif

uniform vec3  iResolution;
uniform vec2  iMouse;
uniform float iTime;

uniform float uAngle;
uniform float uNoise;
uniform float uBlindCount;
uniform float uSpotlightRadius;
uniform float uSpotlightSoftness;
uniform float uSpotlightOpacity;
uniform float uMirror;
uniform float uDistort;
uniform float uShineFlip;
uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec3  uColor4;
uniform vec3  uColor5;
uniform vec3  uColor6;
uniform vec3  uColor7;
uniform int   uColorCount;

varying vec2 vUv;

float rand(vec2 co){
  return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453);
}

vec2 rotate2D(vec2 p, float a){
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c) * p;
}

vec3 getGradientColor(float t){
  float tt = clamp(t, 0.0, 1.0);
  int count = uColorCount;
  if (count < 2) count = 2;
  float scaled = tt * float(count - 1);
  float seg = floor(scaled);
  float f = fract(scaled);

  if (seg < 1.0) return mix(uColor0, uColor1, f);
  if (seg < 2.0 && count > 2) return mix(uColor1, uColor2, f);
  if (seg < 3.0 && count > 3) return mix(uColor2, uColor3, f);
  if (seg < 4.0 && count > 4) return mix(uColor3, uColor4, f);
  if (seg < 5.0 && count > 5) return mix(uColor4, uColor5, f);
  if (seg < 6.0 && count > 6) return mix(uColor5, uColor6, f);
  if (seg < 7.0 && count > 7) return mix(uColor6, uColor7, f);
  if (count > 7) return uColor7;
  if (count > 6) return uColor6;
  if (count > 5) return uColor5;
  if (count > 4) return uColor4;
  if (count > 3) return uColor3;
  if (count > 2) return uColor2;
  return uColor1;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv0 = fragCoord.xy / iResolution.xy;

    float aspect = iResolution.x / iResolution.y;
    vec2 p = uv0 * 2.0 - 1.0;
    p.x *= aspect;
    vec2 pr = rotate2D(p, uAngle);
    pr.x /= aspect;
    vec2 uv = pr * 0.5 + 0.5;

    vec2 uvMod = uv;
    if (uDistort > 0.0) {
      float a = uvMod.y * 6.0;
      float b = uvMod.x * 6.0;
      float w = 0.01 * uDistort;
      uvMod.x += sin(a) * w;
      uvMod.y += cos(b) * w;
    }
    float t = uvMod.x;
    if (uMirror > 0.5) {
      t = 1.0 - abs(1.0 - 2.0 * fract(t));
    }
    vec3 base = getGradientColor(t);

    vec2 offset = vec2(iMouse.x/iResolution.x, iMouse.y/iResolution.y);
  float d = length(uv0 - offset);
  float r = max(uSpotlightRadius, 1e-4);
  float dn = d / r;
  float spot = (1.0 - 2.0 * pow(dn, uSpotlightSoftness)) * uSpotlightOpacity;
  vec3 cir = vec3(spot);
  float stripe = fract(uvMod.x * max(uBlindCount, 1.0));
  if (uShineFlip > 0.5) stripe = 1.0 - stripe;
    vec3 ran = vec3(stripe);

    vec3 col = cir + base - ran;
    col += (rand(gl_FragCoord.xy + iTime) - 0.5) * uNoise;

    fragColor = vec4(col, 1.0);
}

void main() {
    vec4 color;
    mainImage(color, vUv * iResolution.xy);
    gl_FragColor = color;
}
`;

    const { arr: colorArr, count: colorCount } = prepStops(gradientColors);
    const uniforms: {
      iResolution: { value: [number, number, number] };
      iMouse: { value: [number, number] };
      iTime: { value: number };
      uAngle: { value: number };
      uNoise: { value: number };
      uBlindCount: { value: number };
      uSpotlightRadius: { value: number };
      uSpotlightSoftness: { value: number };
      uSpotlightOpacity: { value: number };
      uMirror: { value: number };
      uDistort: { value: number };
      uShineFlip: { value: number };
      uColor0: { value: [number, number, number] };
      uColor1: { value: [number, number, number] };
      uColor2: { value: [number, number, number] };
      uColor3: { value: [number, number, number] };
      uColor4: { value: [number, number, number] };
      uColor5: { value: [number, number, number] };
      uColor6: { value: [number, number, number] };
      uColor7: { value: [number, number, number] };
      uColorCount: { value: number };
    } = {
      iResolution: {
        value: [gl.drawingBufferWidth, gl.drawingBufferHeight, 1]
      },
      iMouse: { value: [0, 0] },
      iTime: { value: 0 },
      uAngle: { value: (angle * Math.PI) / 180 },
      uNoise: { value: noise },
      uBlindCount: { value: Math.max(1, blindCount) },
      uSpotlightRadius: { value: spotlightRadius },
      uSpotlightSoftness: { value: spotlightSoftness },
      uSpotlightOpacity: { value: spotlightOpacity },
      uMirror: { value: mirrorGradient ? 1 : 0 },
      uDistort: { value: distortAmount },
      uShineFlip: { value: shineDirection === 'right' ? 1 : 0 },
      uColor0: { value: colorArr[0] },
      uColor1: { value: colorArr[1] },
      uColor2: { value: colorArr[2] },
      uColor3: { value: colorArr[3] },
      uColor4: { value: colorArr[4] },
      uColor5: { value: colorArr[5] },
      uColor6: { value: colorArr[6] },
      uColor7: { value: colorArr[7] },
      uColorCount: { value: colorCount }
    };

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms
    });
    programRef.current = program;

    const geometry = new Triangle(gl);
    geometryRef.current = geometry;
    const mesh = new Mesh(gl, { geometry, program });
    meshRef.current = mesh;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1];

      if (blindMinWidth && blindMinWidth > 0) {
        const maxByMinWidth = Math.max(1, Math.floor(rect.width / blindMinWidth));

        const effective = blindCount ? Math.min(blindCount, maxByMinWidth) : maxByMinWidth;
        uniforms.uBlindCount.value = Math.max(1, effective);
      } else {
        uniforms.uBlindCount.value = Math.max(1, blindCount);
      }

      if (firstResizeRef.current) {
        firstResizeRef.current = false;
        const cx = gl.drawingBufferWidth / 2;
        const cy = gl.drawingBufferHeight / 2;
        uniforms.iMouse.value = [cx, cy];
        mouseTargetRef.current = [cx, cy];
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scale = (renderer as unknown as { dpr?: number }).dpr || 1;
      const x = (e.clientX - rect.left) * scale;
      const y = (rect.height - (e.clientY - rect.top)) * scale;
      mouseTargetRef.current = [x, y];
      if (mouseDampening <= 0) {
        uniforms.iMouse.value = [x, y];
      }
    };
    canvas.addEventListener('pointermove', onPointerMove);

    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      uniforms.iTime.value = t * 0.001;
      if (mouseDampening > 0) {
        if (!lastTimeRef.current) lastTimeRef.current = t;
        const dt = (t - lastTimeRef.current) / 1000;
        lastTimeRef.current = t;
        const tau = Math.max(1e-4, mouseDampening);
        let factor = 1 - Math.exp(-dt / tau);
        if (factor > 1) factor = 1;
        const target = mouseTargetRef.current;
        const cur = uniforms.iMouse.value;
        cur[0] += (target[0] - cur[0]) * factor;
        cur[1] += (target[1] - cur[1]) * factor;
      } else {
        lastTimeRef.current = t;
      }
      if (!paused && programRef.current && meshRef.current) {
        try {
          renderer.render({ scene: meshRef.current });
        } catch (e) {
          console.error(e);
        }
      }
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('pointermove', onPointerMove);
      ro.disconnect();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
      const callIfFn = <T extends object, K extends keyof T>(obj: T | null, key: K) => {
        if (obj && typeof obj[key] === 'function') {
          (obj[key] as unknown as () => void).call(obj);
        }
      };
      callIfFn(programRef.current, 'remove');
      callIfFn(geometryRef.current, 'remove');
      callIfFn(meshRef.current as unknown as { remove?: () => void }, 'remove');
      callIfFn(rendererRef.current as unknown as { destroy?: () => void }, 'destroy');
      programRef.current = null;
      geometryRef.current = null;
      meshRef.current = null;
      rendererRef.current = null;
    };
  }, [
    dpr,
    paused,
    gradientColors,
    angle,
    noise,
    blindCount,
    blindMinWidth,
    mouseDampening,
    mirrorGradient,
    spotlightRadius,
    spotlightSoftness,
    spotlightOpacity,
    distortAmount,
    shineDirection
  ]);

  return (
    <div
      ref={containerRef}
      className={`gradient-blinds-container ${className}`}
      style={{
        ...(mixBlendMode && {
          mixBlendMode: mixBlendMode as React.CSSProperties['mixBlendMode']
        })
      }}
    />
  );
};

export default GradientBlinds;
```

## Caveats / Not Found

- `raw.githubusercontent.com` was unreachable in this environment; source was instead pulled byte-for-byte through `api.github.com` Contents API (`Accept: application/vnd.github.raw`, `ref=main`). Content is verbatim, but it reflects `main` HEAD as of 2026-06-01 — re-pin to a specific commit/tag if exact reproducibility matters.
- The `ogl` version `^1.0.11` is the version React Bits' own repo pins; React Bits docs typically just say `npm i ogl` without a hard pin.
