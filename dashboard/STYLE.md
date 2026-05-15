# RWA Radar — Design System

Enterprise dark theme. Bloomberg / Linear / TradingView reference. Information-dense, low-chrome, monospace numbers.

## Principles

1. **Information first** — chrome serves data, not the reverse. Borders subtle, padding tight.
2. **Mono for numbers** — every numeric column uses JetBrains Mono. Aligns columns, signals "data".
3. **One accent only** — `--color-accent` (blue). Status colors (`pos`/`neg`) are not decorative.
4. **Hierarchy via weight + opacity**, not size. Body text is 11–13px throughout.
5. **No drop shadows on flat surfaces** — depth via background tone shift only.

## Colors (CSS vars in `src/index.css`, exposed as Tailwind theme tokens)

### Backgrounds (darkest → lightest)
| Token | Hex | Use |
|---|---|---|
| `--color-bg-base` | `#0a0b0f` | App background, inputs |
| `--color-bg-surface` | `#11131a` | Sidebar, panels |
| `--color-bg-elevated` | `#161922` | Selected row, modals |
| `--color-bg-hover` | `#1c2030` | Row hover |

### Borders
| Token | Hex | Use |
|---|---|---|
| `--color-border-subtle` | `#1f2330` | Row dividers, section splits |
| `--color-border-default` | `#2a2f3e` | Inputs, buttons |
| `--color-border-strong` | `#3a4055` | Focus, scrollbar hover |

### Text
| Token | Hex | Use |
|---|---|---|
| `--color-text-primary` | `#e6e8ee` | Body, values |
| `--color-text-secondary` | `#9ba3b4` | Secondary numbers, hover labels |
| `--color-text-tertiary` | `#6b7280` | Column headers, sub-labels |
| `--color-text-muted` | `#4b5263` | Placeholder, disabled |

### Accent + Status
| Token | Hex | Use |
|---|---|---|
| `--color-accent` | `#4f8cff` | Logo dot, focus ring, primary actions |
| `--color-accent-bg` | `rgba(79,140,255,0.12)` | Focus ring fill |
| `--color-pos` | `#1fc16b` | Positive change, up sparkline |
| `--color-neg` | `#ef4444` | Negative change, down sparkline |

## Typography

- **Sans**: `Inter` 400 / 500 / 600 / 700 — UI, labels, names
- **Mono**: `JetBrains Mono` 400 / 500 / 600 — all numeric values, IDs, hashes

### Scale
| Use | Size | Weight | Tracking |
|---|---|---|---|
| App title | 13px | 600 | `0.18em` uppercase |
| Section header | 10px | 500 | `0.05em` uppercase |
| Row primary (symbol) | 13px | 600 | normal |
| Row secondary (name) | 10.5px | 400 | normal |
| Numeric value | 11–12px | 400–500 mono | `tabular-nums` |
| Footer / count | 10px | 400 | uppercase |

Always use `tabular-nums` (`font-mono` does this) for numeric columns so digits align.

## Spacing

Tight. Sidebar internal padding: `px-3 py-2.5`. Section padding: `px-4 py-4`. Gaps in row grids: `gap-2`.

## Layout

- **Sidebar**: `w-[20%]` with `min-w-[280px]`, full height, fixed (non-collapsible v1).
- **Main**: `flex-1`, scrollable.
- **Sidebar internal**: column flex — header / search / table-header / scrollable rows / footer.

## Components

### Sidebar header
Accent dot (`8px`, blue, glow) + uppercase tracked title. Border bottom subtle.

### Search input
8px height. `bg-base` (darker than sidebar). Icon left at 12px. Focus: accent border + accent-bg ring.

### Table row
Grid: `1fr 72px 64px 84px` (token / vol+spark / mcap / 30d-change). Hover: `bg-hover`. Selected: `bg-elevated`. Border-bottom subtle.

Token cell: symbol (primary, semibold) over name (tertiary, smaller).
Volume cell: number above sparkline, both right-aligned.
MCap cell: right-aligned mono.
30d Change cell: triangle (▲/▼) + percent, colored pos/neg, right-aligned mono tabular. Header reads "30d Change" — never abbreviate to "30d" alone (ambiguous).

### Sparkline
Custom SVG, 64×18. Stroke 1.25px. No fill. Color = pos/neg based on first→last delta. No axes, no dots. **Smooth curve via Catmull-Rom → cubic Bezier** (tension 0.5, ends clamped) — no sharp corners.

### Number formatting (`src/lib/format.ts`)
- `formatCompact`: `>=1B` → `1.24B`, `>=1M` → `92.70M`, `>=1K` → `8.4K`, else integer.
- `formatPct`: `+12.4%` / `-4.2%`. UI strips the sign and uses ▲/▼ instead.

## Sort + filter

- Search: case-insensitive substring match on `symbol` + `name`.
- Sort: click column header to toggle (`asc` ↔ `desc`). Default `mcap desc`. Indicator: `↑` / `↓` active, `↕` inactive (low opacity).

## Future (not yet built)

- Row click → opens detail page side panel. Token has `id` field already; selection state lives in `App.tsx`.
- Global search (header) — sidebar search stays scoped to table.
- Per-column filters beyond text search.
