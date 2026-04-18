# 🗺️ Mapa de Projetos — Brasil

Interactive choropleth map for visualizing the distribution of projects across Brazilian states and municipalities.

![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6-purple?logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![D3.js](https://img.shields.io/badge/D3.js-7-orange?logo=d3dotjs)

## Overview

This application renders an interactive map of Brazil where each state is color-coded based on the number of projects it contains. Users can click on any state to drill down into a municipality-level view, showing the geographic distribution of projects at a granular level.

### Features

- **Country-level choropleth** — States colored by project count using a sequential blue scale
- **State drill-down** — Click a state to see its municipalities colored by project count (green scale)
- **Canvas-based rendering** — High-performance drawing with HTML5 Canvas via D3.js geo projections
- **Hover tooltips** — Displays the region name and project count on mouse hover
- **Smart preloading** — Municipality GeoJSON data for the top 5 states is preloaded on idle, and hovered states are preloaded on demand
- **IBGE integration** — Municipality boundaries are fetched dynamically from the [IBGE Malhas API](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3)
- **Color legend** — Gradient legend showing the data range for the current view
- **Responsive layout** — Scales to fit different screen sizes with dark mode support

## Tech Stack

| Technology                                                            | Purpose                                                  |
| --------------------------------------------------------------------- | -------------------------------------------------------- |
| [React 19](https://react.dev)                                         | UI framework with React Compiler enabled                 |
| [TypeScript 5](https://www.typescriptlang.org)                        | Static typing                                            |
| [Vite 6](https://vite.dev)                                            | Dev server and build tool                                |
| [D3.js 7](https://d3js.org)                                           | Geo projections, color scales, and Canvas path rendering |
| [Tailwind CSS 4](https://tailwindcss.com)                             | Utility-first styling                                    |
| [shadcn/ui](https://ui.shadcn.com)                                    | UI component primitives (Radix UI + CVA)                 |
| [Lucide React](https://lucide.dev)                                    | Icon library                                             |
| [IBGE API](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3) | Dynamic municipality boundary data                       |

## Project Structure

```
src/
├── App.tsx                    # Root layout and page title
├── components/
│   ├── BrazilMap.tsx          # Main map component with country/state views
│   ├── GeoCanvas.tsx          # Reusable Canvas-based GeoJSON renderer
│   └── ui/                    # shadcn/ui components
├── data/
│   └── mock-projects.ts       # Sample project data per state/municipality
├── lib/
│   ├── ibge.ts                # IBGE API client with caching and preloading
│   └── utils.ts               # Utility helpers (cn)
public/
└── geojson/
    └── brazil-states.json     # Static state boundaries GeoJSON
```

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm**, **pnpm**, or **yarn**

### Installation

```bash
git clone git@github.com:mateusscm/mapa-brasil.git
cd mapa-brasil
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
```

The production bundle will be output to `dist/`.

### Preview

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## How It Works

1. **Country view** — On load, the app renders a GeoJSON map of all 27 Brazilian states. Each state is filled with a shade of blue proportional to its total project count.
2. **Click to drill down** — Clicking a state fetches its municipality boundaries from the IBGE Malhas API (with in-memory caching) and renders a municipality-level choropleth in green tones.
3. **Canvas rendering** — All map drawing uses HTML5 Canvas for performance. A hidden "hit-test" canvas maps pixel colors to feature IDs, enabling hover and click detection without DOM elements per polygon.
4. **Preloading** — The top 5 states by project count are preloaded via `requestIdleCallback`, and any hovered state triggers a background fetch.

## License

MIT
