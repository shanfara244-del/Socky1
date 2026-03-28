# CLAUDE.md

> Guidelines and context for AI assistants working in this repository.

## Project Overview

**Socky1** is a precision quality control web application for specialty coffee roasters. It serves as a **collaborative sensory intelligence layer** designed to work alongside Cropster, not replace it.

### Vision

An HTML-based app providing exceptionally precise quality control for coffee roasting, targeting premium roasters working with grand cru beans. The app focuses on what Cropster and lighter tools still do less well: collaborative workflows, remote calibration, bias reduction, decision support, client-facing sharing, and cross-session insight extraction.

### Core Objective

**Improve cup quality** by correlating roast curve data with human sensory evaluation. The app helps roasters understand which roasting decisions produce which sensory outcomes — on the same coffee, torréfié differently.

The core loop: **Roast → Cup → Compare → Understand → Progress**

### Target Users

1. **Primary:** Established specialty roasters with dedicated QC teams, already using Cropster
2. **Secondary:** Importers, exporters, and green coffee traders needing shared evaluations
3. **Tertiary:** Multi-location roasters, education/consulting organizations

## Tech Stack

- **Frontend:** HTML/CSS/JavaScript (single-page app, browser-based)
- **Approach:** HTML-first app — lightweight, portable, no heavy framework dependency
- **Integration:** Cropster CSV/JSON import (file-based + bookmarklet for direct API extraction)
- **Sensory Standards:** SCA/CVA-compatible scoring forms
- **Charts:** Chart.js 4.4.7 via CDN (only external dependency)
- **Language:** UI is in French (labels, navigation, messages)

## Key Features (MVP — Implemented)

1. **Cropster Import** — CSV parsing (auto-detects delimiters & columns) + JSON import from Cropster API + browser bookmarklet for one-click extraction
2. **SCA Cupping Protocol** — Full scoring form with slider attributes (6.00–10.00), cup checks (uniformity, clean cup, sweetness), and defect tracking
3. **Roast Curve Visualization** — Bean temp, environment temp, and RoR charts with multi-roast overlay
4. **Correlation Analysis** — Pearson correlation between roast parameters and sensory scores
5. **Roast Phase Detection** — Auto-detects drying, Maillard, and development phases from curve data
6. **RoR Pattern Analysis** — Detects crash, flick, and stall patterns in rate-of-rise
7. **PDF Export** — Analysis results exportable as PDF reports
8. **Dashboard** — Stats overview, recent cuppings, score trend chart

### Planned Features (Not Yet Implemented)

- Shared/multi-user cupping sessions (real-time and async)
- Guest/remote participation with low-friction access
- Panel calibration analytics (disagreement heatmaps, consistency tracking)
- Blind/remote calibration modes with delayed reveal
- Confidence scores for panel consensus
- Drift alerts ("this production roast is trending away from reference")
- Cross-session learning and pattern detection
- Customer-safe vs internal-technical report views

### Out of Scope

- Broad AI claims or "magic" features
- Green buying marketplace
- Inventory/ERP functionality
- Replacing Cropster dashboards

## Repository Structure

```
Socky1/
├── index.html                  # Main SPA shell — all views defined here (598 lines)
├── css/
│   └── app.css                 # Complete styling — dark coffee theme, responsive (856 lines)
├── js/
│   ├── store.js                # LocalStorage persistence layer — CRUD for coffees/roasts/cuppings (225 lines)
│   ├── curve-parser.js         # Cropster CSV + JSON parser — auto-detects delimiters & columns (664 lines)
│   ├── cupping-form.js         # SCA cupping protocol — scoring logic, sliders, cup checks (266 lines)
│   ├── charts.js               # Chart.js wrappers — curves, radar, bars, dashboard trends (344 lines)
│   ├── analysis.js             # Correlation engine — Pearson, phase detection, RoR analysis, PDF export (551 lines)
│   ├── app.js                  # Main controller — routing, views, CRUD, event bindings (695 lines)
│   └── cropster-bookmarklet.js # Readable bookmarklet source — extracts curves from Cropster web UI (129 lines)
├── data/
│   ├── sample-cropster-export.csv   # Test CSV data for development
│   ├── sample-cropster-fast.csv     # Alternate test CSV (faster roast profile)
│   ├── bookmarklet.txt              # Minified bookmarklet (one-liner for browser bookmark URL)
│   └── *.crc                        # Cropster roast curve data files
├── PR-4813_*.pdf               # Sample green coffee spec sheet (Uganda, Zombo)
├── CLAUDE.md                   # AI assistant guidelines (this file)
├── README.md                   # Project overview
└── .gitignore
```

### Architecture

- **SPA with hash routing** — All views in `index.html`, switched via `#hash` (`#dashboard`, `#coffees`, `#roasts`, `#cupping`, `#analysis`)
- **No build step** — Open `index.html` directly in a browser
- **LocalStorage persistence** — All data stored client-side as JSON under `socky1_*` keys
- **Chart.js 4.4.7 via CDN** — Only external dependency
- **IIFE module pattern** — Each JS file exposes a single global: `Store`, `CurveParser`, `CuppingForm`, `Charts`, `Analysis`, `App`
- **Cascade deletes** — Deleting a coffee cascades to its roasts; deleting a roast cascades to its cuppings

### Data Model

```
Coffee  1 ──── * Roast  1 ──── * Cupping
  │                │                │
  id               id               id
  name             coffeeId         roastId
  origin           date             date
  variety          curveData{}      scores{}
  process          chargeTemp         fragrance (6–10)
  altitude         turningPoint       flavor (6–10)
  producer         fcTime/fcTemp      aftertaste (6–10)
  createdAt        dropTime/dropTemp  acidity (6–10)
  updatedAt        devTime/dtr        body (6–10)
                   weightLoss         balance (6–10)
                   totalTime          overall (6–10)
                   agtronWhole        uniformity (0–10)
                   agtronGround       cleanCup (0–10)
                   createdAt          sweetness (0–10)
                   updatedAt        totalScore
                                    defects{}
                                    descriptors{}
                                    cupper
                                    notes
                                    createdAt
                                    updatedAt
```

**LocalStorage keys:** `socky1_coffees`, `socky1_roasts`, `socky1_cuppings`

### Module Responsibilities

| Module | Global | Purpose |
|--------|--------|---------|
| `store.js` | `Store` | CRUD operations, cascade deletes, stats, analysis data aggregation, import/export |
| `curve-parser.js` | `CurveParser` | Parse CSV (auto-detect delimiter/columns) and JSON (Cropster API format) into `{time[], bt[], et[], ror[], meta}` |
| `cupping-form.js` | `CuppingForm` | SCA protocol scoring — binds sliders, cup checks, defects; computes total score |
| `charts.js` | `Charts` | Chart.js wrappers — roast curve line charts, sensory radar, score bars, dashboard trends |
| `analysis.js` | `Analysis` | Pearson correlation, phase detection (drying/Maillard/development), RoR pattern analysis, conclusion generation, PDF export |
| `app.js` | `App` | SPA router, view lifecycle, form bindings, modal management, Cropster file import handling |
| `cropster-bookmarklet.js` | — | Standalone bookmarklet (runs on Cropster pages) — fetches curves/measures/comments via Cropster API, downloads as JSON |

### Cropster Integration Flow

Two import paths are supported:

1. **CSV Import:** User exports CSV from Cropster → uploads in Socky1 → `CurveParser.parse()` auto-detects columns
2. **Bookmarklet Import:** User clicks bookmarklet on Cropster roast page → `cropster-bookmarklet.js` fetches data via Cropster's internal API (`c-sar.cropster.com/api/v2`) using the user's session → downloads JSON → user imports JSON in Socky1 → `CurveParser.parseJSON()` processes it

## Development Setup

### Prerequisites

- Git
- A modern web browser
- (Optional) Cropster account for bookmarklet testing

### Getting Started

```bash
git clone <repo-url>
cd Socky1
# Open index.html in a browser — no build step required
```

### Testing

No automated test suite currently. Manual testing:
- Open `index.html` in a browser
- Add a coffee, import a curve from `data/sample-cropster-export.csv`, perform a cupping
- Verify the analysis view with correlation results

## Development Workflow

### Branching

- Feature branches follow the pattern: `claude/<description>` or `feature/<description>`
- Always develop on feature branches, never push directly to `main`

### Commits

- Write clear, descriptive commit messages
- Use conventional format: `type: short description` (e.g., `feat: add cupping form`, `fix: resolve score calculation`)
- Keep commits focused — one logical change per commit

### Pull Requests

- PRs should have a clear title and summary
- Link related issues when applicable
- Ensure all checks pass before requesting review

## Code Conventions

- **Language:** HTML5, CSS3, vanilla JavaScript (ES6+, strict mode)
- **UI language:** French (all labels, messages, navigation)
- **Module pattern:** IIFE exposing a single global per file
- **File naming:** kebab-case (`cupping-form.js`, `curve-parser.js`)
- **CSS:** Dark coffee theme (`#1a1512` background, `#d4915e` accent), responsive layout
- **No jQuery, no build tools, no bundler**
- **Accessibility:** Semantic HTML, ARIA labels where appropriate
- **Responsive:** Mobile-first design (cupping happens away from desks)

## Domain Glossary

Key specialty coffee terms used throughout the codebase:

| Term | Definition |
|------|-----------|
| **Cupping** | Standardized coffee tasting/evaluation protocol |
| **CVA** | Coffee Value Assessment — SCA's newer multi-dimensional evaluation framework |
| **Grand Cru** | Highest-grade specialty coffees from exceptional terroirs |
| **Panel** | Group of trained tasters evaluating coffees together |
| **Calibration** | Process of aligning tasters' scoring to reduce bias |
| **Roast curve** | Time-temperature profile recorded during roasting (BT, ET, RoR) |
| **BT / ET / RoR** | Bean Temperature / Environment Temperature / Rate of Rise |
| **First Crack (FC)** | Audible cracking during roasting — marks start of development phase |
| **DTR** | Development Time Ratio — time after first crack as % of total roast time |
| **Drift** | Gradual deviation from a reference flavor profile over time |
| **Agtron** | Color measurement scale for roast degree (whole bean and ground) |
| **Cropster** | Industry-standard roast logging and quality management platform |
| **Release/Hold** | QC decision to approve or reject a roasted batch |
| **Turning Point** | Lowest BT after charge — bean mass absorbs heat, temp stops dropping |

## AI Assistant Guidelines

When working in this repository:

1. **Read before writing** — Always read existing files before modifying them.
2. **Minimal changes** — Only change what is needed to complete the task. Do not refactor surrounding code or add unsolicited improvements.
3. **No guessing** — If the intent of existing code is unclear, investigate before changing it.
4. **Security first** — Never introduce credentials, secrets, or security vulnerabilities. Cropster API keys must never be hardcoded.
5. **Keep CLAUDE.md current** — When you add new tooling, frameworks, or conventions, update this file to reflect the changes.
6. **Domain accuracy** — Use correct specialty coffee terminology. Do not invent or guess sensory descriptors, scoring scales, or SCA standards.
7. **Mobile-aware** — Cupping often happens on tablets or phones; always consider responsive design.
8. **Cropster-aware** — Design features assuming Cropster is the system of record for roast data. Do not duplicate Cropster's core functionality.
9. **French UI** — All user-facing text (labels, messages, tooltips) should be in French, consistent with the existing interface.
10. **Module pattern** — New JS files should follow the existing IIFE pattern, exposing a single global. Load order in `index.html` matters — dependencies must be loaded before dependents.
11. **No new dependencies** — Avoid adding external libraries. Chart.js is the only CDN dependency. If a new dependency is truly needed, discuss first.
