# Notion to Diagram — Design Document

## Overview

A Next.js application that takes a Notion page URL and integration token, recursively fetches all content (including subpages), and generates an interactive visual diagram. Users explore the content by clicking nodes to reveal details, making it a learning tool that transforms text-heavy Notion pages into explorable knowledge maps.

## Architecture

Three layers:

### 1. Notion Ingestion Layer (Next.js API routes)

- User provides a Notion page URL and integration token
- Backend extracts the page ID from the URL, calls the Notion API to fetch the page and recursively fetches all child pages/blocks
- Normalizes the raw Notion block tree into a simplified content model: each page becomes a node with a title, summary text, content blocks, and child references

### 2. Diagram Generation Layer (API route + Claude API)

- **Rule-based pass first:** Walks the normalized content tree to produce a default node/edge graph. Pages are nodes, parent-child relationships are edges, headings within a page become sub-nodes
- **AI enrichment pass second:** Sends the content to Claude to:
  - Generate concise labels/summaries for each node
  - Suggest cross-links between related nodes not directly connected in the hierarchy
  - Recommend a layout style (tree, flowchart, mind map) based on content type

### 3. Interactive Frontend (React + React Flow)

- Renders the node/edge graph with React Flow
- Nodes are clickable — clicking expands a side panel showing full Notion content
- Auto-layout using dagre for clean positioning
- Zoom, pan, drag, minimap out of the box

## Data Model

```typescript
// Normalized Notion content
interface NotionNode {
  id: string;
  title: string;
  content: string;
  type: 'page' | 'database' | 'heading';
  children: string[];
  parentId: string | null;
}

// React Flow diagram data
interface DiagramNode {
  id: string;
  label: string;
  fullContent: string;
  type: 'topic' | 'subtopic' | 'detail';
  suggestedLinks: string[];
}

interface DiagramEdge {
  source: string;
  target: string;
  type: 'hierarchy' | 'reference';
}
```

### Normalization pipeline

1. Fetch root page, recursively fetch all child pages and their blocks
2. For each page: extract title, concatenate text blocks into `content`, record parent-child relationships
3. Headings (H1/H2/H3) within a page become sub-nodes, with content being everything between that heading and the next
4. Databases get flattened — each row becomes a child node with its properties as content

## UX Flow

1. **Landing page** — Two inputs: Notion page URL and integration token. "Generate Diagram" button.
2. **Loading state** — Progress indicator with steps: "Fetching Notion pages...", "Analyzing content...", "Generating diagram..."
3. **Diagram view** — Full-screen React Flow canvas:
   - Click a node → side panel with full rendered content
   - Hover a node → tooltip with AI summary
   - Visual distinction: topic (large), subtopic (medium), detail (small). Hierarchy edges are solid, reference edges are dashed
   - Collapse/expand: clicking a node with children toggles its subtree
4. **Toolbar** — Fit-to-view, toggle minimap, toggle reference edges, re-layout

No auth, no persistence. Diagrams are generated on-the-fly.

## Project Structure

```
notion-to-diagram/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Landing page
│   │   ├── diagram/
│   │   │   └── page.tsx              # Diagram view
│   │   ├── api/
│   │   │   ├── notion/
│   │   │   │   └── route.ts          # Fetch + normalize Notion content
│   │   │   └── generate/
│   │   │       └── route.ts          # AI enrichment → diagram data
│   │   └── layout.tsx
│   ├── components/
│   │   ├── DiagramCanvas.tsx
│   │   ├── CustomNode.tsx
│   │   ├── DetailPanel.tsx
│   │   ├── InputForm.tsx
│   │   └── Toolbar.tsx
│   ├── lib/
│   │   ├── notion.ts                 # Notion API client + recursive fetcher
│   │   ├── normalizer.ts             # Raw Notion → NotionNode tree
│   │   ├── ai.ts                     # Claude API for enrichment
│   │   └── layout.ts                 # Dagre auto-layout
│   └── types/
│       └── index.ts
├── package.json
├── tsconfig.json
├── next.config.ts
└── tailwind.config.ts
```

## Dependencies

- `next`, `react`, `react-dom` — Framework
- `@notionhq/client` — Official Notion SDK
- `@anthropic-ai/sdk` — Claude API
- `@xyflow/react` — React Flow v12
- `dagre` — Auto-layout algorithm
- `tailwindcss` — Styling
- `react-markdown` — Rendering content in detail panel

## Decisions

- **Hybrid diagram generation:** Rule-based structure from Notion hierarchy + AI enrichment for summaries and cross-links
- **No persistence:** Diagrams generated on-the-fly, no database needed
- **No auth:** User provides their own Notion token per session
- **Paste URL + token:** Simplest onboarding, OAuth can come later
