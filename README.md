# Notion to Diagram

Transform Notion pages into interactive diagrams. Built with Vite, React, and React Flow.

Notion content is fetched at build time and baked into the static output as a JSON file. The app renders it as an interactive, navigable diagram with multiple layout options.

## Getting Started

### Prerequisites

- Node.js 20+
- A [Notion integration token](https://www.notion.so/my-integrations) and a page ID (optional for dev, required for build with data)

### Environment setup

```bash
cp .env.example .env
```

Edit `.env` with your Notion integration token and page ID. See `.env.example` for all available variables.

### Development

```bash
npm install
npm run dev
```

Opens at http://localhost:5173. Without Notion credentials, the app loads but shows no diagram data.

### Building with Notion data

```bash
npm run build
```

This runs the prebuild script (which reads `NOTION_TOKEN` and `NOTION_PAGE_ID` from your `.env`), then builds the static site into `dist/`.

### Preview

```bash
npm run preview
```

Serves the built `dist/` folder locally.

## Deployment

The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds and deploys to GitHub Pages on every push to `main`.

### Setup

1. In your GitHub repo, go to **Settings > Secrets and variables > Actions**
2. Add `NOTION_TOKEN` and `NOTION_PAGE_ID` as repository secrets
3. Go to **Settings > Pages** and set the source to **GitHub Actions**

## Features

- Interactive diagram with pan, zoom, and node selection
- Multiple layouts: vertical, horizontal, and radial
- Detail panel with rendered markdown content
- Internal link navigation between nodes
- Dark mode with system preference detection
- Saved diagrams via localStorage
