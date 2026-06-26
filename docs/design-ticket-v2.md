# Design System Update Ticket — RPS v2

## 1. Ticket Header

| Field | Value |
|---|---|
| **ID** | DSU-2 |
| **Title** | RPS v2 — Light/Dark theming + Capacity, Forecast & Executive insight surfaces |
| **Owner** | Lead UI/UX Designer |
| **Stack target** | `apps/web` (React + zustand + Chart.js, Dexie data-layer → Supabase later) |

**Goal.** Introduce a persisted Light/Dark theme system (the headline change) on a fully dual-valued semantic-token architecture, then build five capacity/insight surfaces on top of it — without regressing the current dark experience or touching component CSS that already reads semantic tokens.

**In scope**
- Global theme toggle + dual-theme token layer + chart/calendar re-theming.
- New `/capacity` Capacity Planning page (Hiring Decisions).
- Team Utilization small-multiples grid on Insights (`/graphs`).
- Predictive Hiring Forecast (BETA) card + reusable Real Capacity indicator.
- Executive Dashboard persona (KPIs + leaderboards) on `/`.

**Out of scope**
- Supabase migration of the data-layer (still Dexie).
- Modelling "Required Capacity / Required Resources" as a first-class domain entity — treated here as a **NEW data input** (manual target now, project-stage forecast later) and flagged at every consumption point.
- Per-day leave date-ranges (v1 subtracts whole-FTE on `On Leave`).
- `/resources/:id` detail route (leaderboard click-through deep-links the Board instead).

**Praised qualities to preserve** — clean near-monochrome aesthetic, hairline chrome, calm motion (120–320ms ease-out, no bounce/glow/neon), intuitive navigation, square-ish architectural radii, the constant Focal Blue brand anchor. Every new surface adds **zero hard-coded colours** so both themes resolve automatically.

---

## 2. Global — Light/Dark Theme Toggle

The headline change. A quiet top-bar utility that flips a `data-theme` attribute on `<html>`, persisted, OS-aware, re-skinning the whole app through semantic tokens.

### 2.1 Token architecture (the core)

Today every token lives in one `:root{}` block in `apps/web/src/styles/tokens.css` with `color-scheme: dark`. Restructure into three layers so nothing downstream changes:

1. **Primitive scale (theme-agnostic), stays in `:root`** — radii (`--radius-sm/md/lg/xl`), spacing (`--space-*`), typography (`--font-display` Poppins, `--font-sans` Montserrat, `--text-*`), transitions, layout (`--topbar-height` etc.), and constant brand hues (`--brand-primary #1D4EC6`, `--brand-secondary`, `--brand-accent`).
2. **Semantic tokens, split per theme** via attribute selectors on `<html>`:
   - `:root, [data-theme="dark"] { …current values verbatim… }` — zero regression.
   - `[data-theme="light"] { …light values from the table… }`.
   - `color-scheme` becomes per-theme (`dark` block → `color-scheme:dark`, `light` → `color-scheme:light`) to fix native scrollbars / date pickers.
3. **Component CSS is untouched** — `components.css`/`base.css` already reference only semantic vars (`var(--card-bg)`, `var(--gray-900)`, `var(--color-danger)`…), so flipping `data-theme` re-skins everything with no component edits.

### 2.2 Dual-theme semantic token table (token — DARK current | LIGHT new)

**Surfaces** (light = warm off-white; steps DARKEN as they rise — inverse of dark):

| Token | DARK | LIGHT |
|---|---|---|
| `--surface-page` | #0A0A0C | #F4F5F7 |
| `--surface-card` | #131318 | #FFFFFF |
| `--surface-raised` | #1C1C22 | #FBFBFD |
| `--surface-overlay` | #26262E | #FFFFFF |
| `--surface-sunken` | #050507 | #EBECEF |

**Ink / neutral ramp** (light inverts: 50–300 = washes/borders, 400–900 = text):

| Token | DARK | LIGHT | Role |
|---|---|---|---|
| `--gray-50` | #1C1C22 | #F0F1F4 | table header / hover wash |
| `--gray-100` | #26262E | #ECEEF2 | chip / toggle track |
| `--gray-200` | #2E2E38 | #E2E5EA | hairline borders |
| `--gray-300` | #3C3C46 | #D2D6DE | hover border |
| `--gray-400` | #6E7689 | #8A93A6 | placeholder / subtle |
| `--gray-500` | #868B95 | #6B7382 | muted |
| `--gray-600` | #9AA3B4 | #586172 | captions |
| `--gray-700` | #C2C8D4 | #3C4456 | secondary text |
| `--gray-800` | #DCE1EB | #1F2633 | body text |
| `--gray-900` | #FFFFFF | #0C1019 | headings |

**Brand** (constant hue; accent deepened on light for AA on white):

| Token | DARK | LIGHT |
|---|---|---|
| `--brand-primary` | #1D4EC6 | #1D4EC6 |
| `--brand-secondary` | #173C9C | #173C9C |
| `--brand-accent` | #4281FF | #2F6BEB |
| link color | #81ABFF | #1D4EC6 |

**Status** (light = deepened hue for ≥4.5:1 text + lighter tint bg):

| Token | DARK | LIGHT | `-bg` DARK | `-bg` LIGHT |
|---|---|---|---|---|
| `--color-success` | #34C98A | #1F9D6B | rgba(52,201,138,.15) | rgba(31,157,107,.12) |
| `--color-warning` | #E3AD3A | #B07A12 | rgba(227,173,58,.15) | rgba(176,122,18,.13) |
| `--color-danger` | #E2604F | #CB3A2C | rgba(226,96,79,.15) | rgba(203,58,44,.10) |
| `--color-info` | #4281FF | #1D4EC6 | rgba(66,129,255,.15) | rgba(29,78,198,.10) |
| `--color-purple` | #9A8CFF | #6B5BD6 | rgba(154,140,255,.17) | rgba(107,91,214,.12) |

**Disciplines** (deepened for legibility on white chips):

| Token | DARK | LIGHT |
|---|---|---|
| `--disc-mech` | #4281FF | #1D4EC6 |
| `--disc-elec` | #34C98A | #1F9D6B |
| `--disc-bim` | #9A8CFF | #6B5BD6 |
| `--disc-arch` | #E8825A | #C25A30 |
| `--disc-civil` | #CCA24E | #9A7416 |
| `--disc-plumb` (PHE) | #E2719F | #C24A7C |
| `--disc-pm` | #9AA3B4 | #586172 |

**Borders / chrome / shadows / calendar:**

| Token | DARK | LIGHT |
|---|---|---|
| `--border-subtle` | rgba(255,255,255,.08) | rgba(15,20,30,.08) |
| `--border-default` | rgba(255,255,255,.14) | rgba(15,20,30,.14) |
| `--border-focus` | 1px solid var(--brand-accent) | resolves per-theme |
| `--sidebar-bg` / `--topbar-bg` | #0E0E13 | #FFFFFF |
| `--sidebar-active-bg` | rgba(66,129,255,.14) | rgba(29,78,198,.10) |
| `--sidebar-active-text` | #81ABFF | #1D4EC6 |
| `--shadow-sm` | 0 1px 2px rgba(0,0,0,.5) | 0 1px 2px rgba(16,24,40,.06) |
| `--shadow-md` | …rgba(0,0,0,.5) | 0 6px 16px rgba(16,24,40,.08) |
| `--shadow-lg` | …rgba(0,0,0,.58) | 0 14px 36px rgba(16,24,40,.10) |
| `--shadow-xl` | …rgba(0,0,0,.62) | 0 20px 48px rgba(16,24,40,.12) |
| `--weekend-bg` | rgba(255,255,255,.035) | rgba(15,20,30,.04) |
| `--holiday-bg` | rgba(226,96,79,.13) | rgba(203,58,44,.08) |
| `--today-line` | #4281FF | #1D4EC6 |
| `--capacity-line` | rgba(255,255,255,.55) | rgba(15,20,30,.40) |

### 2.3 Toggle control spec

```
TOP BAR (#topbar, height var(--topbar-height) 56px) — toggle sits LEFT of notifications
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ FOCAL / Dashboard            [ ti-search  Search people, projects…  ↵ ]   ☀│🌙   │ 🔔² │ 👤 │
│ └ .topbar-breadcrumb (flex:1) ┘  └────── .topbar-search ──────┘   └theme┘  div  notif user │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                                                            .topbar-actions ──────────────────┘
DESKTOP DEFAULT — 2-segment .theme-toggle (reuses .view-toggle pattern)
   ┌─────────────┐   active=light             ┌─────────────┐
   │ ☀ │  🌙*    │   *active seg=--card-bg    │  ☀* │  🌙   │ ←── dark active
   └─────────────┘   box-shadow --shadow-sm   └─────────────┘
   role="radiogroup" aria-label="Color theme"; seg role=radio aria-checked
   ti-sun (light) · ti-moon (dark)   track --gray-100, pad 2px, radius --radius-md

COMPACT (≤1024px or search collapsed) — single .topbar-btn, shows the icon you'll GET
   ┌────┐  aria-label="Switch to dark theme" · 32×32 · --radius-md
   │ 🌙 │
   └────┘
MOBILE (≤640px): search hidden (existing rule); compact icon stays in .topbar-actions.
DROPDOWN VARIANT (optional): 3rd row in 👤 user menu "Theme: Light · Dark · System".
```

- New `apps/web/src/components/shell/ThemeToggle.tsx`, rendered in `Topbar.tsx` inside `.topbar-actions`, BEFORE the notifications `.dropdown`, followed by a `.topbar-divider`.
- Desktop = 2-segment control reusing `.view-toggle` / `.view-toggle-btn` (+`.active`); new thin `.theme-toggle` wrapper adds only the `aria-label` semantics, visually identical to stay low-chrome.
- Icons Tabler `ti ti-sun` / `ti ti-moon` at 14px (matches `.view-toggle-btn i` and the existing `ti-bell`/`ti-user`). Compact = single `.topbar-btn` (32×32, `--radius-md`).

### 2.4 Persistence & OS default

- Tiny module `apps/web/src/lib/theme.ts` (`getStoredTheme`, `resolveTheme(systemPref)`, `applyTheme(mode)`) writing `localStorage['focal-theme']` = `'light' | 'dark' | 'system'`, default `'system'`.
- `useAppStore` gains `theme` + `setTheme(mode)`, initialised from `localStorage`, applied via side-effect that sets `document.documentElement.setAttribute('data-theme', resolved)`.
- **Anti-FOUC inline script** in `index.html` `<head>` BEFORE the bundle: read stored value (or `matchMedia('(prefers-color-scheme: dark)')`) and set `data-theme` synchronously so first paint is correct.
- `matchMedia` change listener re-resolves only while stored mode is `'system'`. localStorage failure (private mode) silently falls back to in-memory `system`.

### 2.5 Chart, calendar & band re-theming

- **Util bands** (`.util-*`, `.util-cell-*`, `.util-bar-fill.*`) and **calendar shading** (`--weekend-bg`, `--holiday-bg`, `--today-line`, `--capacity-line`) are pure CSS bound to semantic tokens → re-theme automatically, zero logic change. Admin thresholds unaffected.
- **Chart.js needs explicit handling** — `lib/charts.ts` sets `Chart.defaults.*` to hard-coded dark literals at import, and `DemandLine.tsx` inlines whites/blues:
  1. Convert the `Chart.defaults` block into `applyChartTheme()` reading tokens via `cssVar()` (`--gray-600` labels, `--border-subtle` grid/tooltip border, `--surface-overlay` tooltip bg, `--gray-900`/`--gray-800` title/body).
  2. Call `applyChartTheme()` on mount **and** whenever `theme` changes, then `chart.update()` or remount via `key={theme}` on chart wrappers.
  3. In `DemandLine.tsx` replace inlined whites: grid `cssVar('--border-subtle')`, gradient derived from `cssVar('--brand-accent')`; capacity dashed keeps `cssVar('--capacity-line')`.
  4. `UtilDonut` arcs pull from `--color-*`/`--disc-*` via `cssVar()`.

### 2.6 Transitions & reduced motion

- On switch, briefly set a root-level cross-fade `transition: background-color/color/border-color var(--transition-base) ease` (~200ms) on broad surfaces, then remove. No `box-shadow`/`transform` transitions (jank). Matches the 120–320ms ease-out brand rule.
- Charts re-render (not CSS-tween) — instant, no flash.
- `@media (prefers-reduced-motion: reduce)` → cross-fade and the toggle's own micro-transitions collapse to `none` (instant swap).

**Data note:** the theme system is pure presentation state — no engine / data-layer / Supabase impact. Only new persisted field is `focal-theme` (localStorage) + `theme` in `useAppStore`.

---

## 3. Feature Sections

### 3.1 Capacity Planning — Hiring Decisions (`/capacity`)

#### Component Layout

```
┌─ PageHeader ──────────────────────────────────────────────────────────────────────┐
│  Capacity Planning                              [ Manual ⇄ Stage-derived ]  [Export]│
│  Hiring decisions · supply vs demand across disciplines                             │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌─ .card  (.filter-bar) ──────────────────────────────────────────────────────────────┐
│ ┌ .view-toggle ─────────────┐                                                        │
│ │[Weekly][Monthly•][Quarterly]│  [All disciplines ▾]   From [2026-06 ▾] To [2026-12 ▾]│
│ └───────────────────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌─ 4 × .metric-card  (.dashboard-grid-4) ─────────────────────────────────────────────┐
│ Avail. Capacity │ Allocated     │ Required        │ Net Gap (success/danger tint)    │
│  6 120 h        │  5 540 h (90%) │  6 980 h        │  −860 h  ≈ −2.4 hires            │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌─ .card  Combined capacity chart ────────────────────────────────────────────────────┐
│ .card-header  "Supply vs Demand"        ● Available ─ ● Required ─ ▮ Allocated ▮ Gap │
│ .card-body                                                                           │
│   h│  ▁ Required (line, --color-warning, dashed)                                     │
│    │ ████          ███   Allocated (bar, --brand-primary, within Available area)     │
│    │ ████ ░Avail░  ███   Available (area, --brand-accent gradient — same as DemandLine)│
│  0 └──────────────────────────────────────────────── period →                       │
│    │   Gap/Surplus (bar from baseline: red below 0 / green above 0)                  │
│   −│      ▼▼                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌─ .card  DataTable<DeptCapacityRow>  "By Department" ─────────────────────────────────┐
│ Department      Avail. Res.  Required Res.  Avail. h  Required h  Gap (h)  Gap (FTE)  │
│ ●Mechanical          12          14          510        595      −85 ▸red   −2.0 ▸red │
│ ●Electrical           9           8          382        340      +42 subtle +1.0      │
│ ●PHE                  5           7          212        297      −85 ▸red   −2.0 ▸red │
│ ●BIM                  4           4          170        170        0  ─      0.0  ─    │
│ ─────────────────────────────────────────────────────────────────────────────────── │
│ Total                30          33         1274       1402     −128       −3.0       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

- New route `/capacity` in `Sidebar.tsx` (icon `ti ti-chart-arrows-vertical`); page `pages/Capacity.tsx`, `.page-container` with `maxWidth:'none'` (like Summary), `var(--space-5)` rhythm.
- **PageHeader** right-slot: `RequiredSourceToggle` (`.view-toggle` Manual / Stage-derived) + Export `.btn` gated on `can(role,'export')` (reuse Summary's `downloadWorkbook`/`stampedName`).
- **Controls** = one `.card` wrapping a `.filter-bar`: period `.view-toggle` (Weekly/Monthly•/Quarterly), discipline `Select` (`ref.disciplines`), From/To month `Select`s (from `useHorizonWeeks` → `monthKey`/`monthLabel`).
- **4 metric cards** in NEW `.dashboard-grid-4`: Available, Allocated (% in `.metric-sub`), Required, Net Gap. Gap card `.danger` when <0 / `.success` when ≥0; `.metric-sub` = FTE (`gap / weekly_capacity_hours`, "≈ −2.4 hires").
- **Chart** = NEW `CapacityPlanChart.tsx` (sibling of `DemandLine`), mixed `<Chart type='bar'>` (`BarElement`+`LineElement`+`Filler` already registered), `height={300}`, gap on a negatives-allowed axis (`beginAtZero:false`).
- **Table** = `DataTable<DeptCapacityRow>` with `DisciplineTag` dots + `.card-footer` total row, fixed Mechanical/Electrical/PHE/BIM rows.

#### Visual Hierarchy

- **Net Gap is the hero** — only card that tints (`.danger`/`.success`); Gap bars are the only saturated red/green marks. Everything else low-chrome neutral.
- Chart reading weight: Required `--color-warning` dashed line (target) on top > Allocated `--brand-primary` bars nested inside > Available `--brand-accent` gradient area (floor) > Gap bars below baseline. Lines > bars > area.
- Type: `.card-title` Poppins `--text-md`/600; `.metric-value` `--text-2xl`/600; `.metric-label` `--text-sm` `--gray-500`; table body `--text-sm` `--gray-800`.
- Discipline dots are 7px identity dots only (`--disc-*`), never fills. Negative gaps get `util-over` weight 600; surplus stays muted-green regular weight so shortages dominate.

#### Interaction States

- **Period toggle** re-buckets weeks→months→quarters, re-renders with `--transition-base` (200ms, no bounce).
- **Required-source toggle:** Manual reveals inline editable Required cells (number `.form-control`, focus `--border-focus`; on blur persist + recompute Gap with a brief `--color-success` flash). Stage-derived shows them read-only with `ti ti-lock` + `.alert-info` ("Required derived from project stages — switch to Manual to override").
- **Chart hover:** shared crosshair (`interaction:{mode:'index',intersect:false}`), `pointHoverRadius:4`, tooltip lists 4 series + gap sign.
- **DataTable:** sortable, row hover `--gray-50` wash.
- **Loading:** `<Loading/>` until `settings && resources`. **Empty:** DataTable empty state + chart `.muted` "No data to chart for this window". **No Required data:** `.alert-warning` "Required Capacity not modelled yet — enter manual targets per department"; zero the Required series.

**Tokens & data.** Reuses `PageHeader`, `.card*`, `.metric-card(.danger/.success)`, `.filter-bar`, `.view-toggle`, `DataTable`, `DisciplineTag`, `.alert-*`, `can()`, `cssVar()`. NEW: `Capacity.tsx`, `CapacityPlanChart.tsx`, `RequiredSourceToggle`, `.dashboard-grid-4`, `.gap-pos`/`.gap-neg`, engine `groupWeeksByQuarter` + `realCapacityHours`, `capacity_targets {discipline_id, period_key, required_fte|required_hours}` table. **NEW DATA DEPENDENCY:** Required Capacity — Manual target ships first; Stage-derived (needs `forecast_hours`/`required_fte` on project-stage model) disabled until those fields exist.

---

### 3.2 Team Utilization — trend small-multiples (Insights `/graphs`, 3rd view)

#### Component Layout

```
DESKTOP (>=1025px) — .dashboard-grid-2 (2x2)
┌──────────────────────────────────────────────────────────────────────────────┐
│ Insights                                          [ Team ▸ Discipline ▸ Util ] │  PageHeader + .view-toggle
│ Utilization trend by department                          Window: [Next 26 wks▾]│
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────┐  ┌──────────────────────────────┐            │
│ │ • Mechanical        ⬤120% OVER│  │ • Electrical            94%   │  card-header
│ │   avg 103%  peak 120%         │  │   avg 88%  peak 99%           │            │
│ ├──────────────────────────────┤  ├──────────────────────────────┤            │
│ │ 130┤            ╱╲   ← red    │  │ 110┤                          │            │
│ │ 110┄┄┄┄┄┄┄╱╲┄╱┄┄╲┄┄ slightOvr│  │ 100┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ cap ref  │            │
│ │ 100━━━━━╱━━╲━━━━━━━ cap 100%  │  │  90┤      ╱╲   ╱╲              │            │
│ │     ╱╲╱      band zones below │  │     ╱──╲─╱  ╲─╱  ╲ green/lav  │            │
│ │   0└─────────────────────────│  │   0└─────────────────────────│            │
│ │     W1  W6   W12  W18   W26   │  │     W1  W6   W12  W18   W26   │            │
│ └──────────────────────────────┘  └──────────────────────────────┘            │
│ ┌──────────────────────────────┐  ┌──────────────────────────────┐            │
│ │ • PHE                  76%   │  │ • BIM            91% ⬤108%    │            │  (slightOver pill, amber)
│ └──────────────────────────────┘  └──────────────────────────────┘            │
└──────────────────────────────────────────────────────────────────────────────┘
CARD HEADER: [●disc-dot] Name(Poppins)  ……  [⬤ 120% OVER] pill (only >slightOverMax)
             current 120%   avg 103%   peak 120%   12 active   (util-* coloured numbers)
MOBILE (<=768px): single column, chart height 150, metrics stacked.
```

- Extend `Graphs.tsx` `tab` to `'team' | 'discipline' | 'utilization'`; render the 3-way switch as `.view-toggle` (preferred over `.tabs` for a trio). Grid = existing `.dashboard-grid-2` (collapses to 1-col at ≤768px at `components.css:280` — no new grid CSS).
- **Map over engine `GroupSeries[]`** (discipline grouping) — do NOT hard-code four cards; extra disciplines wrap naturally.
- Per card = `.card` > `.card-header` (left: 8px discipline dot via `DisciplineTag` markup + `.card-title`; right: over pill — `.badge-red .badge-dot` `{peak}% OVER` only when `peak > slightOverMax`, optional `.badge-amber` for 101–110) > metric strip (`.trend-metrics` flex, current/avg/peak via `utilTextClass`) > `.card-body` holding **NEW `TrendMini`** (`height={200}` desktop / `150` mobile).
- `TrendMini` = trimmed `DemandLine` plotting **util%** not hours: one dataset (weekly util%) + flat 100% capacity reference (dashed `--capacity-line`), legend hidden, `maxTicksLimit:6` x / `4` y, `suggestedMax: Math.max(120, peak+10)`, `tension:0.4`, `pointRadius:0`, `pointHoverRadius:4`.

#### Visual Hierarchy

- **Over-utilization is the loudest signal** — the `.badge-red .badge-dot` is the only saturated fill; one pill per card so the grid reads "which depts are red?" instantly.
- **100% capacity line is the mental baseline** (`--capacity-line` dashed) — heavier/lighter than band tints so it never gets lost.
- Band-coloured trend line carries the story: under→`--color-info`, moderate→`--color-purple`, full→`--color-success`, slightOver→`--color-warning`, over→`--color-danger` (stroke reddens + faint `--color-danger-bg` zone above 110).
- Numbers colour-keyed but quiet (`--text-sm`/`--text-md`, weight 600–700); dept name Poppins `--gray-900` anchor; labels `--gray-500` recede. **Emphasis order:** danger pill → red over-segment+zone → 100% line → peak → trend line → current/avg → axis/name.

#### Interaction States

- **Over-util treatment, all token-driven:** (1) scriptable `segment.borderColor` — `>slightOverMax` → `--color-danger`, `>fullMax` → `--color-warning`, else band colour; (2) area gradient switches to `--color-danger` low-alpha when `peak > slightOverMax`; (3) header `.badge-red .badge-dot`.
- **Hover:** `interaction:{mode:'index',intersect:false}`, tooltip "Week-N · 120%", point grows to radius 4 in band colour; optional 1px border brighten to `--border-default` on card `:hover` only.
- **Window `<Select>`** (12/26/52/all) re-slices `weeks`, re-renders all cards in sync.
- **Loading:** `<Loading/>` while `settings`/`resources`/`allocations` undefined. **Empty:** `series.length===0` → `.card` + `.muted` "No data to chart for this window."; 0-active-capacity dept → `EmptyState` "No active capacity", suppress chart (no NaN%).

**Tokens & data.** Reuses `.dashboard-grid-2`, `.card*`, `.badge-red/.badge-amber/.badge-dot`, `.view-toggle`, `utilTextClass`, `DisciplineTag`, `cssVar()`. Source = `buildDemandCapacity(resources, allocations, weeks, r=>r.discipline_id, …)`; **per-week util% = `capacityHours>0 ? demandHours/capacityHours*100 : null`** (guard NaN); avg = `Σdemand/Σcapacity*100`; peak = `Math.max(...)`; thresholds from `settings.util_thresholds` (key off `slightOverMax`, never hard-coded 110). NEW: `TrendMini.tsx`, `.trend-card`, `.trend-metrics`, optional `.util-pill--over`. **Dependency:** light-theme token values + chart re-render on `data-theme` change (Chart.js caches resolved colours). No "Required Capacity" dependency — uses actual capacity only.

---

### 3.3 Predictive Hiring Forecast (BETA) — Insights `/graphs`

#### Component Layout

```
DESKTOP — Predictive Hiring Forecast card (.card on /graphs)
┌──────────────────────────────────────────────────────────────────────────┐
│ Predictive Hiring Forecast  [BETA]ⓘ        [ 8 wks | 12 wks | 26 wks ]    │ .card-header + .view-toggle
├──────────────────────────────────────────────────────────────────────────┤
│ ⚠  Projected shortage — Hire 3 Mechanical Engineers      [Plan hire][Dismiss]│ .alert-danger
│    Demand exceeds real capacity by ~128 h/wk in 8 weeks (heuristic).        │
│ DEPARTMENT        CURRENT REAL CAP.   DEMAND IN 8 WKS        RECOMMEND      │
│ ● Mechanical      340 h ▮▮▮▮▮▯        468 h ▮▮▮▮▮▮ (red)     ( +3 hires )   │ danger pill
│   8 active · −1 leave                                                      │
│ ● Electrical      255 h ▮▮▮▮▮▮        242 h ▮▮▮▮▮▮ (green)   ( Balanced )   │
│ ● BIM             170 h ▮▮▮▮▮▮         96 h ▮▮▯▯▯ (blue)     ( 1.7 FTE slack)│
│ ────────────────────────────────────────────────────────────────────────  │
│ Mechanical — gap projected forward (heuristic)                            │
│   ┌────────────────────────────────────────────────┐                      │ DemandLine variant
│   │ ····· capacity (dashed) ────── demand (gradient)│ │ forecast→           │ vertical "now" divider
│   │ now                                      +8 wks │                      │
│   └────────────────────────────────────────────────┘                      │
├──────────────────────────────────────────────────────────────────────────┤
│ Heuristic estimate · "Required Capacity" is a NEW data input.              │ .card-footer (muted)
└──────────────────────────────────────────────────────────────────────────┘
REAL CAPACITY indicator (reusable, inline anywhere capacity shows)
   Capacity ⓘ   340 h   ( −42.5 h this week ·leave/holiday )   ← .badge-amber chip
        ┌───────────────────────────────────────┐  popover (.dropdown-menu styling)
        │ Real Capacity this week                │
        │ Nominal (8 × 42.5h)              340 h │
        │ − Approved leave (1 person)    −42.5 h │  amber
        │ − Public holiday (Eid, 1 day)  −54.4 h │  amber
        │ ─────────────────────────────────────  │
        │ Real capacity                    243 h │  green, bold
        └───────────────────────────────────────┘
BETA-OFF: ┌ ✓ Forecasting is in beta. [ Enable forecast ] ┐    MOBILE ≤768px: stacked, chart hidden, popover→bottom sheet
```

- **`ForecastCard.tsx`** in Insights `.dashboard-grid-2`/`.stack`. `.card-header`: title + `BETA` `.badge-purple` + `ⓘ` (RealCapacity-style trigger) left; horizon `.view-toggle` (8/12/26 wks, default 8, persisted in `appStore` like `persona`) right.
- **`RecommendationAlert`** (wrapper over `.alert`): one per breaching dept, `.alert-danger`/`.alert-warning`, `ti ti-alert-circle/-triangle`, bold `<strong>` headline + one-line detail + right action group (`.btn.btn-primary.btn-sm` "Plan hire" + ghost "Dismiss"). >3 collapse to summary + "view all (n)".
- **`ForecastDeptRow`** table (DataTable conventions): Department (dot + name + sub "N active · −M leave"), Current real cap (hours + grey `.util-bar` track), Demand (hours + `.util-bar-fill` by band), Recommend (`.badge` pill: red `+N hires` / green `Balanced` / blue `X FTE slack`).
- **Projection strip** = `DemandLine` instance + vertical "now" divider + `forecast →` label.
- **`RealCapacity.tsx`** (3 composable parts): `RealCapacityInfo` (`ti ti-info-circle` button), popover reusing `.dropdown-menu` (~300px, 2-col `.realcap-breakdown`), `RealCapacityChip` (`.badge-amber` + `ti ti-calendar-minus`, only when reduction > 0). Reusable everywhere capacity shows (Insights, Summary, Board headers, Dashboard demand-vs-capacity).

#### Visual Hierarchy

- **Primary = the recommendation alert** — full-width tinted band, bold Poppins headline ("Hire 3 Mechanical Engineers") is the loudest element.
- **Secondary = Recommend pills + band-coloured demand numbers** (right-aligned scan). **Tertiary = current real capacity** in neutral `--gray-800`/grey bar. **Quaternary = chart + footer disclaimer** `--gray-500`/`--gray-400` `--text-xs`.
- Real Capacity chip: amber is calmer than red (a reduction is informational, not a conflict); the green popover total is the resolved truth the eye lands on last.

#### Interaction States

- **Beta opt-in:** `EmptyState` "Forecasting is in beta" + "Enable forecast" `.btn` (persisted flag). **Loading:** `.skeleton-title` + 3 `.skeleton-rect`. **Empty:** `EmptyState` "Not enough data to forecast". **Balanced:** muted "All departments within capacity for this horizon", pills show Balanced/slack.
- **Horizon change** recomputes (200ms `--transition-base`). **Row hover** `--gray-50`; click expands its `DemandLine` projection. **Plan hire** → prefilled flow / People filtered by discipline; **Dismiss** → session-hide + activity log. Buttons `:active{transform:translateY(1px)}`.
- **RealCapacity:** ⓘ hover → popover (desktop, 120ms fade + 6px translate like `.dropdown-menu.open`); keyboard `<button>` focusable, focus ring `0 0 0 3px color-mix(--brand-accent 28%)`, Enter/Space toggles, Esc closes, `aria-describedby` chip→popover, `role="tooltip"`; touch → bottom sheet ≤768px; chip hidden when reduction = 0.

**Tokens & data.** Reuses `.card*`, `.alert-*`, `.badge-*`/`.badge-dot`, `.view-toggle`, `.btn*`, `.util-bar*`, `utilTextClass`, `.dropdown-menu` + outside-click pattern, `.skeleton*`, `EmptyState`, `DemandLine`, Tabler icons. NEW: `ForecastCard`, `ForecastDeptRow`, `HorizonToggle`, `RecommendationAlert`, `RealCapacityInfo`/`Popover`/`Chip`, CSS `.forecast-row`/`.forecast-bar-pair`/`.recommend-pill`/`.beta-tag`/`.realcap-popover`/`.realcap-chip`/`.realcap-breakdown`. **Real Capacity** (available today) = Nominal (Active × 42.5) − On-Leave whole-FTE (v1; precise per-day needs leave date-range field — flagged) − holiday hours (`holiday_days × 42.5/5 × headcount` per location); wire as `realCapacityHours` per `buildDemandCapacity` point. **Forecast** = linear-slope projection of `demandHours` to horizon (explicitly heuristic); gap FTE = `(projectedDemand − realCapacity)/42.5`, `N hires = ceil(gap)`; bands admin-configurable like `util_thresholds`. **NEW DATA DEPENDENCY (flag prominently in footer + ⓘ):** Required Capacity unmodeled; clean upgrade = `department_target {dept_id, horizon, required_fte}`, required before forecast leaves beta.

---

### 3.4 Dynamic Capacity Controls — Real Capacity (leave/holiday) indicator

> Companion to 3.3: the **reusable Real Capacity indicator** is the dynamic-capacity control, codified here as a system-wide component so every capacity number across the app (Insights, Resource Summary, Allocation Board headers, Dashboard "Upcoming Demand vs Capacity") reflects *real* (leave/holiday-adjusted) capacity, not nominal.

#### Component Layout

```
INLINE (anywhere a capacity value renders)
   Capacity ⓘ   340 h   [ −42.5 h this week ]      ← label + value + .realcap-chip (.badge-amber)
                  │ hover / click / focus
                  ▼
   ┌───────────────────────────────────────┐  .realcap-popover (extends .dropdown-menu)
   │ Real Capacity this week                │  --shadow-lg, --radius-lg, ~300px, caret
   │ Nominal (8 × 42.5h)              340 h │  .realcap-breakdown (2-col label/value)
   │ − Approved leave (1 person)    −42.5 h │  amber
   │ − Public holiday (Eid, 1 day)  −54.4 h │  amber
   │ ─────────────────────────────────────  │
   │ Real capacity                    243 h │  --color-success, bold
   │ Holidays from this location's calendar.│  --gray-500 caption
   └───────────────────────────────────────┘
NO-REDUCTION: chip absent; ⓘ popover → "Real capacity = nominal (no leave/holidays this week)".
```

- Three composable parts (shared with 3.3): `RealCapacityInfo` (14px `ti ti-info-circle`, `--gray-400` → hover `--gray-700`), `RealCapacityPopover` (`.realcap-popover` extends `.dropdown-menu`), `RealCapacityChip` (`.realcap-chip` extends `.badge-amber` + `ti ti-calendar-minus`).
- Mount points: any "Capacity" label across Insights / Summary / Board headers / Dashboard. The chip renders inline after the capacity value; the ⓘ carries the breakdown.

#### Visual Hierarchy

- The capacity **value** stays the anchor in neutral `--gray-800`; the **amber chip** is a calm informational delta (not a conflict); inside the popover the **green total** is the resolved truth the eye lands on last. Nominal/deductions are muted; deductions amber to tie to the chip.

#### Interaction States

- **ⓘ default → hover:** `--gray-400` → `--gray-700`; popover opens (desktop hover; 120ms `--transition-fast` fade + 6px translate, mirroring `.dropdown-menu.open`).
- **Keyboard:** `<button>` focusable, focus ring `0 0 0 3px color-mix(in srgb, var(--brand-accent) 28%, transparent)`, Enter/Space toggles, Esc closes, outside-click closes (Topbar `useEffect` pattern), `role="tooltip"` + `aria-describedby`.
- **Touch / ≤768px:** tap toggles; popover becomes a bottom sheet. **Chip:** static, non-interactive; hidden when reduction = 0.

**Tokens & data.** Reuses `.dropdown-menu`(.open) + outside-click, `.badge-amber`, `--color-success`, `--gray-400/700/800`, `--shadow-lg`, `--radius-lg`, `--transition-fast`, Tabler `ti-info-circle`/`ti-calendar-minus`. NEW: `.realcap-popover`/`.realcap-chip`/`.realcap-breakdown`. Math identical to 3.3's Real Capacity. Recommend wiring `realCapacityHours` into `buildDemandCapacity` so charts/donut everywhere reflect real capacity. v1 caveat: whole-FTE leave subtraction (precise per-day leave = future field).

---

### 3.5 Executive Dashboard — KPIs + Leaderboards (`/`, `persona === 'executive'`)

#### Component Layout

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ PageHeader: "Executive Overview"   subtitle: "Week of 2026-06-25 · live capacity"      │
│ [View as: Resource Mgr | Executive | Project Mgr | Discipline Lead]      right→ [Export]│
├──────────────────────────────────────────────────────────────────────────────────────┤
│  .metric-grid .metric-grid-5                                                           │
│ ┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────────────────────┐          │
│ │ Total    ││ Utilized ││ Under-   ││ Over-    ││ ⚠ Hiring Required (.danger) │         │
│ │ Staff    ││ Staff    ││ utilized ││ utilized ││  metric-card.danger when>0  │         │
│ │  142     ││  118 ↑   ││   17     ││   7      ││        3                    │         │
│ │ Active   ││ 91–110%  ││ <80%     ││ >110%    ││ depts below req. capacity   │         │
│ │ headcount││ this wk  ││(info)    ││(danger)  ││  [View hiring plan →]       │          │
│ └──────────┘└──────────┘└──────────┘└──────────┘└──────────────────────────┘          │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  .dashboard-grid-2  (two leaderboard cards, side-by-side ≥1025px)                      │
│ ┌────────────────────────────────────────┐ ┌────────────────────────────────────────┐ │
│ │  ● Top 10 Overloaded   [peak ▾][8wk ▾] │ │  ● Top 10 Available    [now ▾]         │ │
│ ├────────────────────────────────────────┤ ├────────────────────────────────────────┤ │
│ │ # │ Resource │ Dept │ Peak │ Trend      │ │ # │ Resource │ Dept │ Util │ Spare    │ │
│ │ 01 ◑K Khan   [●Mech] 134%  ╱╲╱ red     │ │ 01 ◑M Said  [●Elec]  42%   24.6h       │ │
│ │ 02 ◑A Patel  [●BIM ] 121%  ╱‾╲ red     │ │ 02 ◑R Omar  [●PHE ]  55%   19.1h       │ │
│ │ … rows are <Link>, hover=.gray-50      │ │ …                                       │ │
│ │ ── empty: "No overloaded staff 🎉" ──  │ │ ── empty: "Everyone is at capacity" ── │ │
│ │ .card-footer: View all on Board →      │ │ .card-footer: View all People →        │ │
│ └────────────────────────────────────────┘ └────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘
 (≤768px: .metric-grid-5 → 2-col, Hiring wraps full-width; .dashboard-grid-2 → 1-col)
```

- New `ExecutiveDashboard` component selected when `persona === 'executive'` (extend `PERSONA_SECTIONS.executive` from `{demand,donut}` to `{kpis5, leaderboards}`). Scaffold = `.page-container` + `PageHeader` + existing `View as:` row.
- **KPI row** = `.metric-grid .metric-grid-5` (already collapses to 2-col ≤1024/≤768 — no new CSS): Total Staff `ti-users`, Utilized `ti-gauge`, Under-utilized `ti-arrow-down-circle`, Over-utilized `ti-alert-circle` (`.danger` when >0), Hiring Required `ti-user-plus` (`.metric-card.danger` when >0, with inline `.btn.btn-sm.btn-ghost` "View hiring plan →" in `.metric-sub`).
- **Leaderboards** = `.dashboard-grid-2` × 2 `.card` (`.card-header` title + `.view-toggle` window/sort → `.table-wrap > table.table` sticky `th` → `.card-footer` `<Link>` "View all").
- **`LeaderboardRow`** (presentational, wrapped in `<Link>`): Rank `01`–`10` (`.rank-num` `--font-mono` `--gray-400` right 28px) · Resource (`.avatar.avatar-sm` initials + `r.forename`) · Dept (7px `--disc-*` dot + name / `DisciplineTag`) · Metric (Overloaded=Peak%, Available=Util%, `utilTextClass`, weight 700, right) · Trailing (Overloaded=`<Sparkline values={series} max={Math.max(120,peak)}>`; Available=`fmtHours((1-factor)×capacity)`).

#### Visual Hierarchy

- **Hiring Required is the loudest object** when >0 (`.metric-card.danger`: `--color-danger-bg` fill + `--color-danger` border + danger `.metric-value`); rightmost KPI, only CTA. When 0 it falls back to neutral so a healthy org looks healthy.
- KPIs read left→right as a funnel: Total → Utilized (`--color-success`) → Under (`--color-info`) → Over (`--color-danger`) → Hiring (danger CTA); the two problem cards cluster right.
- Numbers dominate (`.metric-value` `--text-2xl` Poppins/600 `--gray-900`), labels recede (`--gray-500`/`--gray-400`). Colour reserved for status only; chrome stays hairline `--border-subtle` on `--surface-card`.
- Two leaderboards mirrored but tonally opposite: left header dot `--color-danger`, right `--color-success`/`--color-info`. Rank numerals `--font-mono` `--gray-400` give a quiet league-table read.

#### Interaction States

- **Row hover** `--gray-50` + pointer + `box-shadow: inset 2px 0 0 var(--color-danger)` (left) / `var(--color-success)` (right) via `.leaderboard-row--over`/`--avail`, 120ms `--transition-fast`. **Focus** row `<Link>` `box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-accent) 28%, transparent)`, tabbable in rank order. **Active:** brief `--gray-100`.
- **Row click-through:** → `/board?res={r.id}` (**NEW dependency:** `Board.tsx` must read a `res` search-param and scroll/highlight that row; fallback `/board` + toast). Hiring CTA → `/graphs`.
- **Window/sort toggles** (`.view-toggle` per header): Overloaded `This week | Next 8 wks (peak)`; Available `This week | Avg 8 wks`; persisted to `appStore` (`execOverWindow`/`execAvailWindow`).
- **Loading:** `<Loading/>` or 10× `.skeleton-rect`. **Empty:** "No overloaded staff 🎉" / "Everyone is at or above capacity." via `.table-empty`. **Tooltip:** native `title` on sparkline/util cells.

**Tokens & data.** Reuses `.page-container`, `PageHeader`, `.metric-grid`/`.metric-grid-5`, `.dashboard-grid-2`, `.card*`, `.table-wrap`/`.table`, `.view-toggle`, `.btn*`, `.metric-card.danger/.warning/.success`, `.badge-gray`, util classes, `.avatar.avatar-sm`, `Sparkline`, `DisciplineTag`, `EmptyState`/`.table-empty`, `initials()`/`fmtPercent()`/`fmtHours()`/`bandClass()`, `cssVar()`. All five KPIs + lists derive from the existing `Dashboard.tsx` model (`factorsByResourceWeek`, `classifyBand`, `settings.util_thresholds/weekly_capacity_hours/overalloc_threshold/bench_threshold`). Top10 Overloaded reuses `model.top10`; Available = NEW `useAvailableResources` (Active sorted ascending by util, spare = `(1−factor)×42.5`). NEW: `ExecutiveDashboard`, `LeaderboardCard`, `LeaderboardRow`, `useAvailableResources`, `.leaderboard-row`/`--over`/`--avail`, `.rank-num`, `appStore.execOverWindow/execAvailWindow`. **NEW DATA DEPENDENCY:** Hiring Required needs Required Capacity per dept — until modeled, fall back to `model.gaps` and label the card "Capacity Gaps"; plus the `res` search-param in `Board.tsx`.

---

## 4. Cross-Cutting Rulebook

### 4.1 Visual Hierarchy (system-wide)

1. **One hero per surface.** Each screen has exactly one loudest object — the only saturated status fill: Capacity → Net Gap card; Team Util → the over pill; Forecast → the recommendation alert; Executive → Hiring Required card. Everything else is the monochrome ink ramp.
2. **Colour is reserved for status, never decoration.** Brand blue = supply/identity; `--color-warning` = demand target; `--color-danger`/`--color-success` = polarity (shortage/surplus, over/healthy); band ramp (`--color-info`→`--color-danger`) = utilization. Discipline `--disc-*` appears only as 7px identity dots, never fills.
3. **The brand anchor is constant.** `--brand-primary #1D4EC6` is identical in both themes; primary buttons, active sidebar accent, and the FOCAL breadcrumb stay on-brand whichever theme is active.
4. **Numbers dominate, labels recede.** Values `--text-2xl`/`--text-md` weight 600–700; labels `--gray-500` `--text-xs`/`--text-sm`. Colour-keyed numbers (via `utilTextClass`) confirm a chart, never compete with it.
5. **Type roles fixed.** Poppins (`--font-display`) for headings/buttons/titles; Montserrat (`--font-sans`) for body/UI; `--font-mono` for tabular ranks only.
6. **Chrome stays hairline.** Cards `--surface-card` + `--border-subtle`; cards step lighter on rise (dark) / darker on rise (light); dividers are borders, not boxes. Reference lines (`--capacity-line`, 100% line) read above band tints but below content.
7. **Chart layering weight:** target lines > bars > area fills, mirroring the sleek `DemandLine` aesthetic.

### 4.2 Interaction States (system-wide)

1. **Segmented controls** (`.view-toggle`/`.view-toggle-btn`): hover → `--gray-700`/`--gray-800`; `.active` → `--card-bg` + `--shadow-sm`; switching re-renders with `--transition-base` (200ms ease-out, no bounce).
2. **Focus-visible** everywhere: `--border-focus` (1px `--brand-accent`, 2px offset) on inputs/toggles; `box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-accent) 28%, transparent)` on rows/icon-buttons. Ensure ≥3:1 ring contrast in both themes (deepened light accent secures this).
3. **Keyboard:** segmented = `radiogroup` (Left/Right move, Space/Enter select); popovers Enter/Space toggle + Esc close + outside-click close (Topbar `useEffect` pattern); table rows tabbable in display order.
4. **Hover affordances stay calm:** row/list hover = `--gray-50` wash (+ optional 1px `--border-default` brighten or inset status bar); buttons `:active{transform:translateY(1px)}`; no glow/scale on cards.
5. **Chart interaction** uniform: `interaction:{mode:'index',intersect:false}`, `pointHoverRadius:4`, dark/light tooltip from `applyChartTheme()` tokens.
6. **Edit-in-place** (Capacity Manual targets): inline `.form-control`, persist on blur, brief `--color-success` flash on the recomputed cell.
7. **Lifecycle states standardised:** Loading → `<Loading/>` or `.skeleton-*`; Empty → `EmptyState`/`.table-empty`/`.muted` with a human line; Error → global `ErrorBoundary`; missing-Required-data → `.alert-warning` + zeroed series, never a crash.
8. **Theme switch** triggers a chart re-render (`key={theme}` / `chart.update()`); all motion respects `prefers-reduced-motion: reduce` (instant, `transition:none`); motion capped at `--transition-slow` 320ms.

---

## 5. Appendix

### (a) New design tokens / CSS classes

| Name | Type | Purpose |
|---|---|---|
| `[data-theme="light"]` / `[data-theme="dark"]` | CSS attr blocks | dual-theme semantic token layer + per-theme `color-scheme` |
| `.theme-toggle` (+ `.theme-toggle-seg`) | class | semantic a11y wrapper over `.view-toggle` |
| `.dashboard-grid-4` | class | 4-up metric grid, collapses to 1-col <900px |
| `.gap-pos` / `.gap-neg` | class | surplus-green-muted / shortage-danger-600 text |
| `.trend-card` | class | `.card` modifier: min-height + 1px hover border |
| `.trend-metrics` | class | flex current/avg/peak strip, `gap:var(--space-4)` |
| `.util-pill--over` | class | optional dedicated over pill (alias of `.badge-red`) |
| `.forecast-row` / `.forecast-bar-pair` | class | dept row + dual grey/coloured mini-bars |
| `.recommend-pill` | class | `.badge` modifier, red/green/blue per band |
| `.beta-tag` | class | `.badge-purple` + letter-spacing |
| `.realcap-popover` | class | extends `.dropdown-menu`, fixed ~300px + caret |
| `.realcap-chip` | class | extends `.badge-amber` + calendar icon |
| `.realcap-breakdown` | class | 2-col label/value grid |
| `.leaderboard-row` (+ `--over`/`--avail`) | class | inset status bar on hover |
| `.rank-num` | class | `--font-mono` `--gray-400` tabular rank |
| `localStorage['focal-theme']` | persisted | `'light'|'dark'|'system'`, default `system` |
| `appStore.theme` / `execOverWindow` / `execAvailWindow` / forecast horizon + beta flag | store | persisted UI state |

*No new colour tokens — all new surfaces resolve from existing semantic tokens, so both themes re-theme automatically.*

### (b) New components & engine helpers

- **Shell/theme:** `components/shell/ThemeToggle.tsx`, `lib/theme.ts`, `tokens.css` restructure, `index.html` anti-FOUC script, `lib/charts.ts` `applyChartTheme()`, `useAppStore` theme additions.
- **Capacity:** `pages/Capacity.tsx`, `CapacityPlanChart.tsx`, `RequiredSourceToggle`, engine `groupWeeksByQuarter` + `realCapacityHours`, `capacity_targets` table + provider methods.
- **Team Util:** `components/charts/TrendMini.tsx`.
- **Forecast / Dynamic capacity:** `ForecastCard`, `ForecastDeptRow`, `HorizonToggle`, `RecommendationAlert`, `RealCapacityInfo` / `RealCapacityPopover` / `RealCapacityChip`.
- **Executive:** `ExecutiveDashboard`, `LeaderboardCard`, `LeaderboardRow`, `useAvailableResources` selector; `Board.tsx` `res` search-param deep-link.
- **NEW data inputs (flagged):** `capacity_targets` / `department_target {dept_id, horizon, required_fte}` (manual Required now); project-stage `forecast_hours`/`required_fte` (Stage-derived later); leave date-range field (precise Real Capacity later).

### (c) Accessibility

- **WCAG AA in BOTH themes.** Body `--gray-800`: dark #DCE1EB on #131318 ≈ 13:1, light #1F2633 on #FFFFFF ≈ 15:1 (AAA). Muted `--gray-600` captions: light #586172 on #FFFFFF ≈ 6.4:1, dark #9AA3B4 on #131318 ≈ 7:1 (AA). `--gray-400` is placeholder/subtle ONLY (light #8A93A6 ≈ 3.0:1 — meets 3:1 UI/large rule; never essential body text). Status/util numbers use deepened light hues (`--color-warning #B07A12`, `--color-danger #CB3A2C`) for ≥4.5:1 on white; `-bg` tint cells keep the deepened hue as foreground. Focus ring ≥3:1 vs background in both themes.
- **Colour-blind-safe encoding (never colour alone):** gap polarity carries sign + "hires"/"slack" text and bar direction (above/below baseline), not just red/green. Over-util carries an explicit "OVER" pill label + `{peak}%` number + the line crossing the 100% reference, in addition to the red stroke. Recommend pills carry text (`+3 hires` / `Balanced` / `1.7 FTE slack`). Discipline identity uses dot + name label, never colour alone.
- **Keyboard:** segmented controls = arrow-navigable radiogroups; popovers Enter/Space/Esc + outside-click; leaderboard rows tabbable `<Link>`s in rank order; all toggles/inputs are real `<button>`/`<input>` with visible focus.
- **Reduced motion:** `prefers-reduced-motion: reduce` disables the theme cross-fade and all micro-transitions (instant swap); all motion ≤ `--transition-slow` 320ms, ease-out, no bounce/glow.

### (d) Phased implementation plan + acceptance criteria

**Phase 0 — Theme foundation (ships first, blocks all visual work).**
- Restructure `tokens.css` into primitive `:root` + `[data-theme]` blocks; add anti-FOUC script; `useAppStore.theme` + `lib/theme.ts`; `ThemeToggle.tsx`; `applyChartTheme()`.
- *Accept:* toggling theme flips `<html data-theme>` and re-skins the whole app with **no component CSS edits**; choice persists across reload; first paint matches stored/OS preference (no flash); `system` mode live-updates on OS change; charts/calendar/util bands re-theme; reduced-motion = instant swap; dark theme is pixel-identical to today (zero regression).

**Phase 1 — Capacity Planning (`/capacity`).**
- *Accept:* 4 KPI cards + mixed chart + dept table render from engine; Net Gap card tints `.danger`/`.success` with FTE sub; Manual targets edit inline and persist (Dexie) recomputing Gap; period toggle re-buckets W/M/Q; Stage-derived disabled with `.alert-warning` until forecast fields exist; export gated on `can(role,'export')`.

**Phase 2 — Team Utilization grid + Dynamic Capacity indicator.**
- *Accept (Util):* third Insights view renders one `TrendMini` per discipline from `GroupSeries`; util% guards 0-capacity (no NaN); over pill + red line/zone key off `settings.util_thresholds.slightOverMax`; window selector re-renders in sync; cards re-theme on toggle.
- *Accept (Real Capacity):* chip shows only when reduction > 0; popover breakdown (nominal − leave − holiday = real) opens on hover/click/focus, closes on Esc/outside-click; component reused on Insights + Summary + Board headers + Dashboard.

**Phase 3 — Predictive Hiring Forecast (BETA).**
- *Accept:* card is opt-in beta (persisted); recommendation alerts severity-mapped per breaching dept with Plan-hire/Dismiss; dept rows show real cap vs projected demand + recommend pill; horizon toggle (8/12/26) recomputes and persists; footer + ⓘ both surface the "Required Capacity is a NEW data input / heuristic" caveat; projection chart re-themes.

**Phase 4 — Executive Dashboard.**
- *Accept:* `persona === 'executive'` renders 5-KPI grid + two leaderboards; Hiring Required card is `.danger` only when >0 (falls back to "Capacity Gaps" via `model.gaps` until Required modeled); Overloaded reuses `model.top10` with Sparkline, Available uses `useAvailableResources` with spare hours; rows deep-link `/board?res={id}` (with `Board.tsx` highlight) or fall back gracefully; window toggles persist; empty/loading states present.