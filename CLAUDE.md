# CLAUDE.md

> Guidelines and context for AI assistants working in this repository.

## Project Overview

**Socky1** is a precision quality control web application for specialty coffee roasters. It serves as a **collaborative sensory intelligence layer** designed to work alongside Cropster, not replace it.

### Vision

An HTML-based app providing exceptionally precise quality control for coffee roasting, targeting premium roasters working with grand cru beans. The app focuses on what Cropster and lighter tools still do less well: collaborative workflows, remote calibration, bias reduction, decision support, client-facing sharing, and cross-session insight extraction.

### Core Value Proposition

- Reduce costly quality mistakes on expensive specialty coffees
- Align sensory panels across people, sites, and time
- Speed up release/hold decisions with consensus-driven QC
- Bridge the gap between roast curve data and sensory outcomes
- Provide structured, shareable reporting for internal and external stakeholders

### Target Users

1. **Primary:** Established specialty roasters with dedicated QC teams, already using Cropster
2. **Secondary:** Importers, exporters, and green coffee traders needing shared evaluations
3. **Tertiary:** Multi-location roasters, education/consulting organizations

## Tech Stack

- **Frontend:** HTML/CSS/JavaScript (single-page app, browser-based)
- **Approach:** HTML-first app — lightweight, portable, no heavy framework dependency initially
- **Integration:** Cropster API for roast curve sync and quality data linking
- **Sensory Standards:** SCA/CVA-compatible scoring forms

## Key Features (MVP Scope)

1. **Cropster Import/Sync** — Link roast curves to cupping sessions
2. **Shared Cupping Sessions** — Real-time and asynchronous multi-user evaluation
3. **Guest/Remote Participation** — Low-friction access without complex account setup
4. **SCA/CVA-Compatible Forms** — Modern sensory scoring aligned with current standards
5. **Panel Calibration Analytics** — Inter-cupper agreement, disagreement heatmaps, consistency tracking
6. **Roast-Curve-Linked Review** — Evaluate sensory results in context of roast data
7. **Shareable Reports** — Internal (technical) vs external (client-facing) report modes

### Planned Differentiators

- Disagreement heatmaps by attribute and cupper
- Blind/remote calibration modes with delayed reveal
- Confidence scores for panel consensus
- Drift alerts ("this production roast is trending away from reference")
- Cross-session learning and pattern detection
- Customer-safe vs internal-technical report views

### Out of Scope (for now)

- Broad AI claims or "magic" features
- Green buying marketplace
- Inventory/ERP functionality
- Replacing Cropster dashboards

## Repository Structure

```
Socky1/
├── CLAUDE.md          # AI assistant guidelines (this file)
├── README.md          # Project overview for contributors
├── .gitignore         # Ignored files and directories
└── (app files TBD)
```

> Update this section as the project structure evolves.

## Development Setup

### Prerequisites

- Git
- A modern web browser
- (Optional) Cropster account with API access for integration testing

### Getting Started

```bash
git clone <repo-url>
cd Socky1
```

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

- **Language:** HTML5, CSS3, vanilla JavaScript (initially)
- **File naming:** kebab-case (`cupping-form.html`, `panel-analytics.js`)
- **CSS:** BEM methodology or utility-first approach (to be decided)
- **JavaScript:** ES6+ modules, no jQuery, strict mode
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
| **Roast curve** | Time-temperature profile recorded during roasting |
| **Drift** | Gradual deviation from a reference flavor profile over time |
| **Cropster** | Industry-standard roast logging and quality management platform |
| **Release/Hold** | QC decision to approve or reject a roasted batch |

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
