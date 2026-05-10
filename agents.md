# agents.md — AI Agent Instructions for `react-grafana-prom`

> **Purpose**: This file provides AI coding agents with complete context about the `react-grafana-prom` library so they can build new, beautiful components compatible with Prometheus and Thanos time-series data — components that look more modern and premium than Grafana's native panels.

---

## 1. Project Overview

**Package name**: `react-grafana-prom`  
**Version**: `0.1.2`  
**License**: MIT  
**NPM**: Published as a public package  

### What this library does

A lightweight, Grafana-inspired React component library for rendering Prometheus, Thanos, and general monitoring time-series data. Built on **Recharts**, it keeps the data contract simple — your backend fetches metrics, normalizes them, and passes `TimeSeries[]` directly to the chart components.

### Key design principles

1. **Prometheus/Thanos-native data contract** — `[timestamp, value]` tuples with labels
2. **Unit-aware formatting** — 80+ built-in unit formatters matching Grafana's unit system
3. **Theme-aware** — light, dark, and auto (system preference) modes
4. **Zero backend coupling** — components only consume normalized data, no direct Prometheus API calls
5. **Beautiful by default** — shadcn-inspired card styling, not plain Grafana grey

---

## 2. Architecture & File Structure

```
react-grafana-prom/
├── src/
│   ├── index.ts                          # Public API — all exports go here
│   ├── types.ts                          # Shared TypeScript interfaces
│   ├── styles.css                        # Global CSS (Tailwind @layer components)
│   ├── components/
│   │   └── TimeSeriesChart.tsx           # Main chart component (566 lines)
│   └── lib/
│       ├── formatters.ts                 # 80+ value formatters (bytes, %, duration, etc.)
│       └── series.ts                     # Data normalization & stat aggregation
├── dist/                                 # Build output (do not edit)
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tailwind.config.ts                    # Tailwind with `rgp-` prefix
└── postcss.config.cjs
```

### Build Pipeline

```bash
npm run build
# 1. Cleans dist/
# 2. Runs tailwindcss to compile src/styles.css → dist/styles.css (minified)
# 3. Runs tsc with tsconfig.build.json → dist/*.js + dist/*.d.ts
```

- **Module format**: ESM only (`"type": "module"`)
- **Target**: ES2020
- **JSX**: `react-jsx` transform (no React import needed)
- **CSS**: Tailwind v3 with `rgp-` prefix to avoid class collisions

### Peer Dependencies (do NOT add these as direct deps)

```json
{
  "react": ">=18",
  "react-dom": ">=18",
  "recharts": ">=2.12.0"
}
```

---

## 3. Data Contract

### `TimeSeries` — The universal data shape

Every component in this library consumes `TimeSeries[]`. This is the **one data format** that all components share.

```ts
interface TimeSeries {
  id?: string;                                                    // Optional unique ID
  name?: string;                                                  // Display name (fallback to labels)
  labels?: Record<string, string | number | boolean | null>;      // Prometheus labels { pod: "web-0", namespace: "prod" }
  points: Array<[number | string | Date, number | null]>;         // [timestamp, value] tuples
  unit?: string;                                                  // Unit ID: "bytes", "percentunit", "ms", etc.
  color?: string;                                                 // Override series color
}
```

### Time values

Components must handle all timestamp formats:
- **Unix seconds**: `1713780000` (auto-detected if < 10 billion)
- **Unix milliseconds**: `1713780000000`
- **ISO strings**: `"2026-04-26T10:00:00Z"`
- **Date objects**: `new Date()`

Use `toTimestamp()` from `lib/series.ts` to normalize — it handles all formats.

### Point format variants

```ts
// Tuple format (most common with Prometheus)
points: [[1713780000, 0.43], [1713780300, 0.51]]

// Object format
points: [{ time: 1713780000, value: 0.43 }, { time: 1713780300, value: 0.51 }]
```

---

## 4. Unit & Formatting System

Located in `src/lib/formatters.ts`. This is **critical** — new components must use this system.

### How to use formatters

```ts
import { getValueFormat, formattedValueToString } from '../lib/formatters.js';

const formatter = getValueFormat('bytes');           // Returns a ValueFormatter function
const result = formatter(523986944, 2);              // Returns { text: "499.5", suffix: " MiB" }
const display = formattedValueToString(result);      // Returns "499.5 MiB"
```

### Supported unit categories

| Category     | Example IDs                                                         |
|-------------|----------------------------------------------------------------------|
| Numbers     | `none`, `short`, `sishort`, `locale`, `sci`                         |
| Percent     | `percent` (0-100), `percentunit` (0.0-1.0)                         |
| Data        | `bytes`, `decbytes`, `bits`, `kbytes`, `mbytes`, `gbytes`           |
| Data Rate   | `Bps`, `binBps`, `bps`, `KBs`, `MBs`, `GBs`                       |
| Time        | `ns`, `us`, `ms`, `s`, `m`, `h`, `d`, `dtdurationms`, `dtdurations`|
| Throughput  | `ops`, `reqps`, `rps`, `wps`, `iops`, `eps`, `mps`                 |
| Currency    | `currencyINR`, `currencyUSD`, `currencyEUR`, `currencyGBP`         |
| Temperature | `celsius`, `fahrenheit`, `kelvin`                                   |
| Boolean     | `bool`, `bool_yes_no`, `bool_on_off`                                |

### Custom unit patterns (via string prefixes)

```
"suffix:blocks"    → appends " blocks"
"prefix:$"         → prepends "$"
"si:H/s"           → SI-scaled (kH/s, MH/s, GH/s)
"count:tx/s"       → scaled count (K tx/s, M tx/s)
"bool:Healthy/Down"→ boolean with custom labels
"currency:₹"       → custom currency symbol
```

### Registering custom formatters

```ts
import { registerValueFormat } from '../lib/formatters.js';

registerValueFormat('blockHeight', (value) => ({
  text: Math.round(value ?? 0).toLocaleString(),
  suffix: ' blocks',
}));
```

---

## 5. CSS Design System

### Theme Variables (CSS Custom Properties)

All visual tokens live in `src/styles.css` as CSS variables on the card root. **Every new component MUST use these variables** — never hardcode colors.

```css
--rgp-card-bg        /* Card background: #ffffff (light) / #0b1220 (dark) */
--rgp-card-subtle    /* Subtle background for hover/empty states */
--rgp-text           /* Primary text color */
--rgp-muted          /* Secondary/label text color */
--rgp-axis           /* Axis line color (translucent) */
--rgp-grid           /* Grid line color (translucent) */
--rgp-border         /* Border color */
--rgp-accent         /* Accent/focus color (blue) */
--rgp-crosshair      /* Crosshair/cursor color */
--rgp-tooltip-bg     /* Tooltip background (with backdrop-blur) */
```

### Theme Modes

Three modes exist. Components get themed automatically via parent class:

| Mode   | CSS Class          | Behavior                              |
|--------|--------------------|---------------------------------------|
| `auto` | `.rgp-theme-auto`  | Follows `prefers-color-scheme`        |
| `light`| `.rgp-theme-light` | Always light                          |
| `dark` | `.rgp-theme-dark`  | Always dark                           |

Also detects `.dark`, `[data-theme='dark']`, `[data-mode='dark']` on ancestors.

### Tailwind Configuration

- **Prefix**: `rgp-` (all utilities are prefixed to avoid collisions)
- **Content**: `./src/**/*.{ts,tsx}`
- All component styles use `@apply` within `@layer components` in `src/styles.css`
- Class naming convention: `rgp-{component}-{element}--{modifier}`

### CSS Architecture Pattern

```css
@layer components {
  /* Root */
  .rgp-{component-name} { ... }

  /* Elements */
  .rgp-{component-name}-{element} { ... }

  /* Modifiers */
  .rgp-{component-name}--{modifier} { ... }
  .rgp-{component-name}-{element}--{modifier} { ... }
}
```

---

## 6. Existing Component: `TimeSeriesChart`

### Full Props API

```ts
interface TimeSeriesChartProps {
  series: TimeSeries[];                        // REQUIRED — array of time-series data
  title?: ReactNode;                           // Card header title
  description?: ReactNode;                     // Card header subtitle
  actions?: ReactNode;                         // Top-right action buttons
  footer?: ReactNode;                          // Card footer content
  card?: boolean;                              // true = bordered card, false = plain/embedded
  unit?: string;                               // Default unit for all series ("bytes", "percentunit", etc.)
  variant?: 'line' | 'area';                   // Chart type
  theme?: 'auto' | 'light' | 'dark';          // Color theme
  height?: number;                             // Chart height in px (default: 320)
  aspectRatio?: number;                        // Alternative: responsive ratio (e.g. 16/9)
  fallbackSize?: { width: number; height: number }; // For SSR / zero-size containers
  decimals?: number;                           // Fixed decimal places
  className?: string;                          // Root element class
  chartClassName?: string;                     // Chart canvas class
  colors?: string[];                           // Custom color palette
  legend?: boolean | ChartLegendOptions;       // Legend configuration
  showGrid?: boolean;                          // Show grid lines (default: true)
  showTooltip?: boolean;                       // Deprecated — use tooltip.show
  tooltip?: boolean | ChartTooltipOptions;     // Tooltip configuration
  syncId?: string;                             // Sync crosshair across multiple charts
  emptyState?: ReactNode;                      // Custom "no data" content
}
```

### Internal Architecture

1. **`normalizeSeries()`** — Converts raw `TimeSeries[]` into `{ rows, series }` for Recharts
2. **`useElementSize()`** — ResizeObserver hook for responsive sizing
3. **Legend** — Interactive: click toggles, double-click isolates, search for many series
4. **Tooltip** — Custom `TooltipContent` component with scrolling, sorting, highlighting
5. **Gradient defs** — Unique SVG gradient IDs per instance (via `useId()`)

### Default Color Palette

```ts
const DEFAULT_CHART_COLORS = [
  '#22c55e',  // Green
  '#3b82f6',  // Blue
  '#f59e0b',  // Amber
  '#a855f7',  // Purple
  '#ef4444',  // Red
  '#06b6d4',  // Cyan
  '#84cc16',  // Lime
  '#f97316',  // Orange
  '#14b8a6',  // Teal
  '#e11d48',  // Rose
];
```

---

## 7. How to Build New Components

### Step-by-step process

#### 1. Define types in `src/types.ts`

Add your new component's props interface to the shared types file:

```ts
// Example: StatPanel
export interface StatPanelProps {
  series: TimeSeries[];           // Always use TimeSeries[] as the data input
  title?: ReactNode;
  unit?: UnitId;
  theme?: ChartTheme;
  // ... component-specific props
}
```

#### 2. Create the component file

Place it in `src/components/{ComponentName}.tsx`:

```ts
"use client";  // REQUIRED — all components must be client components

import type { StatPanelProps } from '../types.js';
import { formattedValueToString, getValueFormat } from '../lib/formatters.js';
import { normalizeSeries, getSeriesStat } from '../lib/series.js';
```

#### 3. Add CSS classes in `src/styles.css`

Add new classes inside the existing `@layer components { ... }` block:

```css
@layer components {
  /* ... existing classes ... */

  .rgp-stat-panel {
    @apply rgp-w-full rgp-rounded-lg rgp-border rgp-border-[var(--rgp-border)]
           rgp-bg-[var(--rgp-card-bg)] rgp-text-[var(--rgp-text)] rgp-shadow-sm;
  }

  .rgp-stat-value {
    @apply rgp-text-4xl rgp-font-bold rgp-tabular-nums rgp-text-[var(--rgp-text)];
  }
}
```

#### 4. Export from `src/index.ts`

```ts
export { StatPanel } from './components/StatPanel.js';
export type { StatPanelProps } from './types.js';
```

#### 5. Build and verify

```bash
npm run build
npm run typecheck
```

---

## 8. New Components to Build (Priority Order)

### 8.1 `StatPanel` — Single-value display

**Grafana equivalent**: Stat panel  
**Use case**: Show current CPU usage, memory, uptime, request count

**Requirements**:
- Consumes `TimeSeries[]`, displays a single aggregated value (last, min, max, avg)
- Optional sparkline (mini area chart behind the value)
- Color thresholds: green/yellow/red based on value ranges
- Optional trend indicator (↑ ↓ →) comparing current vs previous value
- Supports `unit` prop for formatting
- Multiple stat panels in a grid layout
- Premium design: large numbers with subtle gradients, glass-morphism background, pulse animation on value change

**Props sketch**:
```ts
interface StatPanelProps {
  series: TimeSeries[];
  title?: ReactNode;
  unit?: UnitId;
  stat?: 'last' | 'min' | 'max' | 'avg' | 'sum' | 'count';
  sparkline?: boolean;
  thresholds?: Array<{ value: number; color: string }>;
  orientation?: 'horizontal' | 'vertical';
  colorMode?: 'value' | 'background' | 'none';
  theme?: ChartTheme;
  decimals?: number;
  className?: string;
}
```

### 8.2 `GaugePanel` — Circular/bar gauge

**Grafana equivalent**: Gauge panel  
**Use case**: Show percentage utilization, health scores, SLA compliance

**Requirements**:
- Circular arc gauge or horizontal/vertical bar gauge
- Color thresholds with smooth gradient transitions
- Min/max labels
- Current value displayed in center
- Animated fill on mount
- Supports all unit formatters
- Premium: glowing arc edges, subtle shadow, animated needle

### 8.3 `BarChart` — Categorical or time-bucketed bars

**Grafana equivalent**: Bar chart panel  
**Use case**: Compare metrics across pods, namespaces, services

**Requirements**:
- Vertical and horizontal orientations
- Grouped and stacked bar modes
- Uses same `TimeSeries[]` input
- Tooltip with same formatting system
- Interactive legend (same pattern as TimeSeriesChart)
- Premium: rounded bar caps, gradient fills, hover glow

### 8.4 `Table` — Tabular metric display

**Grafana equivalent**: Table panel  
**Use case**: List all pods with CPU, memory, restarts as columns

**Requirements**:
- Columns auto-derived from series labels
- Sortable columns
- Color-coded cells based on thresholds
- Pagination for large datasets
- Formatted values using unit system
- Premium: alternating row colors, sticky headers, smooth sort animations

### 8.5 `Heatmap` — Time×bucket density visualization

**Grafana equivalent**: Heatmap panel  
**Use case**: Request latency distribution over time (histogram_quantile)

**Requirements**:
- Time on X-axis, buckets on Y-axis, color intensity = count
- Configurable color scheme (cool/warm/spectral)
- Tooltip showing bucket range and count
- Supports histogram-style Prometheus data

### 8.6 `AlertList` — Active alerts display

**Use case**: Show firing Prometheus alerts with severity, labels, duration

**Requirements**:
- Different data contract (alert objects, not TimeSeries)
- Severity badges (critical/warning/info)
- Expandable detail view
- Sort by severity, time, name
- Premium: pulsing critical indicators, smooth expand animations

### 8.7 `LogsViewer` — Log line display

**Use case**: Display Loki/log data alongside metrics

**Requirements**:
- Virtual scrolling for large log volumes
- Syntax highlighting for JSON logs
- Severity-based line coloring
- Timestamp formatting
- Search/filter functionality

### 8.8 `StatusMap` — Grid of colored cells

**Grafana equivalent**: Status map plugin  
**Use case**: Show service health across time (uptime grid)

**Requirements**:
- Grid cells colored by value/threshold
- Time-based columns, series-based rows
- Tooltip with value and timestamp
- Configurable cell size

---

## 9. Coding Conventions & Rules

### Must follow

1. **`"use client"` directive** — Every component file starts with this
2. **`.js` extensions in imports** — Required for ESM (`'../types.js'`, not `'../types'`)
3. **No direct React import** — Use `react-jsx` transform (just import types/hooks)
4. **CSS variables, never hardcoded colors** — Use `var(--rgp-*)` for all colors
5. **`joinClassNames()` utility** — Use the existing utility for conditional classes, do not add `clsx` or `classnames`
6. **`cssVars()` utility** — Use for inline CSS custom properties: `style={cssVars({ '--my-var': value })}`
7. **Tailwind `rgp-` prefix** — All utility classes must use the `rgp-` prefix
8. **Peer dependencies only** — Do NOT add React, ReactDOM, or Recharts as direct deps
9. **Export everything from `src/index.ts`** — Components AND their prop types

### Naming conventions

| Item | Convention | Example |
|------|-----------|---------|
| Component file | PascalCase | `StatPanel.tsx` |
| Component export | PascalCase | `export function StatPanel` |
| Props type | PascalCase + "Props" | `StatPanelProps` |
| CSS root class | `rgp-{name}` | `.rgp-stat-panel` |
| CSS element | `rgp-{name}-{element}` | `.rgp-stat-panel-value` |
| CSS modifier | `--{modifier}` | `.rgp-stat-panel--horizontal` |
| CSS variable | `--rgp-{name}-{prop}` | `--rgp-stat-sparkline-height` |
| Data key / internal | camelCase | `getSeriesStat()` |

### Accessibility

- All interactive elements must be `<button>` (not `<div onClick>`)
- Include `title` attributes on truncated text
- Use `aria-label` for icon-only buttons
- Support keyboard navigation (`focus-visible` ring is already in the design system)
- Color must not be the only indicator — use icons/text alongside color

### Responsive design

- Components must be 100% width by default (`rgp-w-full`)
- Use `ResizeObserver` for container-aware sizing (see `useElementSize` pattern)
- Support `height` and `aspectRatio` props
- Mobile-first: single column legends on small screens, side legends on `md:` and up

---

## 10. Design Philosophy — Surpassing Grafana

### What makes Grafana look dated

- Flat, grey card backgrounds
- No depth or layering
- Thin, monotone chart lines
- Basic tooltips
- No micro-animations
- Dense, utilitarian legend

### What our components should feel like

- **Glassmorphism**: Subtle `backdrop-blur` on tooltips and overlays
- **Depth**: Multi-layer shadows (`shadow-sm` base, `shadow-xl` on tooltips)
- **Gradients**: Area fills with premium gradient stops (not flat color)
- **Micro-animations**: Smooth transitions on hover, legend toggle, value changes
- **Typography**: Tabular numbers (`tabular-nums`) for values, semibold headings
- **Spacing**: Generous padding, never cramped
- **Color harmony**: Vibrant but not garish palette, dark mode that feels rich (deep navy, not pure black)
- **Interactive feedback**: Highlight on hover, opacity transitions, focus rings

### Color palette guidance

```
Dark mode background:   #0b1220 (deep navy, NOT #000000)
Dark mode surface:      #111827 (slightly lighter navy)
Dark mode text:         #f8fafc (warm white)
Dark mode muted:        #94a3b8 (slate-400)
Dark mode border:       #263244 (visible but subtle)
Dark mode accent:       #60a5fa (vivid blue)

Light mode background:  #ffffff
Light mode surface:     #f8fafc
Light mode text:        #0f172a (near-black blue)
Light mode muted:       #64748b (slate-500)
Light mode border:      #e2e8f0 (slate-200)
Light mode accent:      #3b82f6 (blue-500)
```

### Threshold color scheme

```
Green (good):     #22c55e / #10b981
Yellow (warning): #f59e0b / #eab308
Orange (caution): #f97316
Red (critical):   #ef4444 / #dc2626
```

---

## 11. Reusable Patterns from TimeSeriesChart

When building new components, **reuse these existing patterns**:

### Card wrapper pattern

```tsx
<div className={joinClassNames(
  'rgp-{component}',
  !card && 'rgp-{component}--plain',
  `rgp-theme-${theme}`,
  className
)}>
  {renderTitle(title, description, actions)}
  {/* component content */}
  {footer && <div className="rgp-chart-card-footer">{footer}</div>}
</div>
```

### Data consumption pattern

```tsx
const normalized = useMemo(
  () => normalizeSeries(series, { colors, defaultUnit: unit }),
  [colors, series, unit]
);
```

### Value formatting pattern

```tsx
const formatter = getValueFormat(unit);
const display = formattedValueToString(formatter(value, decimals));
```

### Theme application pattern

```tsx
theme?: 'auto' | 'light' | 'dark';
// Applied via: `rgp-theme-${theme}` class on root element
// CSS handles the rest via variables
```

### Responsive sizing pattern

```tsx
const [containerRef, containerSize] = useElementSize<HTMLDivElement>();
const width = containerSize.width > 0 ? containerSize.width : fallbackSize.width;
```

---

## 12. Testing & Verification

After creating a new component:

1. **Type check**: `npm run typecheck` must pass with zero errors
2. **Build**: `npm run build` must produce `dist/` output with `.js`, `.d.ts`, and updated `styles.css`
3. **Export check**: Verify the component and its types are exported from `src/index.ts`
4. **CSS check**: All new CSS classes must be inside `@layer components { ... }` in `src/styles.css`
5. **Theme check**: Component must look correct in all 3 theme modes
6. **Empty state**: Component must handle `series={[]}` gracefully
7. **Unit formatting**: Values must be formatted using `getValueFormat()` — no raw numbers

---

## 13. Quick Reference — Adding a Component Checklist

```
□ Define props interface in src/types.ts
□ Create src/components/{Name}.tsx with "use client" directive
□ Use .js extensions in all imports
□ Consume TimeSeries[] via normalizeSeries()
□ Format values via getValueFormat() + formattedValueToString()
□ Apply theme via `rgp-theme-${theme}` class
□ Use CSS variables (--rgp-*) for all colors
□ Add CSS classes in src/styles.css inside @layer components
□ Use rgp- prefix on all Tailwind utilities
□ Export component + types from src/index.ts
□ Handle empty state (no data)
□ Support card={true|false} mode
□ Test: npm run typecheck && npm run build
□ Ensure dark mode looks premium (not just inverted)
□ Add hover states and transitions
□ Verify tabular-nums on numeric displays
```

---

## 14. Important: What NOT to Do

- ❌ Do NOT install new dependencies without explicit approval
- ❌ Do NOT add `react` or `recharts` as direct dependencies (they are peer deps)
- ❌ Do NOT use inline colors — always use `var(--rgp-*)` CSS variables
- ❌ Do NOT create separate CSS files per component — everything goes in `src/styles.css`
- ❌ Do NOT use `className` libraries (clsx, classnames) — use the existing `joinClassNames()`
- ❌ Do NOT skip the `"use client"` directive
- ❌ Do NOT use bare imports without `.js` extension
- ❌ Do NOT hardcode chart sizes — always support responsive containers
- ❌ Do NOT create API-fetching logic — this library is data-display only
- ❌ Do NOT modify `tailwind.config.ts` prefix — `rgp-` is intentional to prevent conflicts
