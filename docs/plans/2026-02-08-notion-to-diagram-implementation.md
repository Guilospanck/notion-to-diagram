# Notion to Diagram — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Next.js app that fetches Notion pages and renders them as interactive, AI-enriched diagrams using React Flow.

**Architecture:** Next.js fullstack — API routes handle Notion fetching and Claude AI enrichment server-side, React Flow renders the interactive diagram client-side. Data flows: User inputs → `/api/notion` (fetch+normalize) → `/api/generate` (AI enrich) → React Flow canvas.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, @xyflow/react (React Flow v12), @dagrejs/dagre, @notionhq/client, @anthropic-ai/sdk, react-markdown.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `.env.local`, `.gitignore`

**Step 1: Initialize Next.js project**

Run:
```bash
cd /Users/guilospanck/repos/MyRepositories/notion-to-diagram
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Pick defaults for all prompts. This creates the full scaffold.

**Step 2: Install additional dependencies**

Run:
```bash
npm install @notionhq/client @anthropic-ai/sdk @xyflow/react @dagrejs/dagre react-markdown
npm install -D @types/dagre
```

**Step 3: Create `.env.local`**

Create `.env.local` with placeholder keys:

```
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

**Step 4: Create `.gitignore` additions**

Ensure `.env.local` and `node_modules` are in `.gitignore` (create-next-app should handle this, but verify).

**Step 5: Initialize git and commit**

Run:
```bash
git init
git add -A
git commit -m "chore: scaffold Next.js project with dependencies"
```

**Step 6: Verify dev server starts**

Run:
```bash
npm run dev
```

Expected: Server starts on localhost:3000 without errors.

---

### Task 2: Type Definitions

**Files:**
- Create: `src/types/index.ts`

**Step 1: Write type definitions**

```typescript
// src/types/index.ts

// --- Notion ingestion types ---

export interface NotionNode {
  id: string;
  title: string;
  content: string;
  type: 'page' | 'database' | 'heading';
  children: string[];
  parentId: string | null;
}

export interface NotionTree {
  nodes: Record<string, NotionNode>;
  rootId: string;
}

// --- Diagram types ---

export type DiagramNodeType = 'topic' | 'subtopic' | 'detail';

export interface DiagramNode {
  id: string;
  label: string;
  fullContent: string;
  type: DiagramNodeType;
  suggestedLinks: string[];
}

export interface DiagramEdge {
  source: string;
  target: string;
  type: 'hierarchy' | 'reference';
}

export interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

// --- API request/response types ---

export interface NotionFetchRequest {
  pageUrl: string;
  token: string;
}

export interface GenerateRequest {
  tree: NotionTree;
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared type definitions"
```

---

### Task 3: Notion API Client — Fetcher

**Files:**
- Create: `src/lib/notion.ts`

**Step 1: Write the Notion fetcher**

This module connects to the Notion API, extracts a page ID from a URL, fetches a page and all its children recursively.

```typescript
// src/lib/notion.ts
import { Client } from '@notionhq/client';
import type {
  BlockObjectResponse,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';

export function extractPageId(url: string): string {
  // Notion URLs look like:
  // https://www.notion.so/Page-Title-abc123def456...
  // https://www.notion.so/workspace/abc123def456...
  // Or just a raw ID: abc123-def456-...
  const cleaned = url.split('?')[0].split('#')[0];
  // Match 32-char hex ID (with or without dashes)
  const match = cleaned.match(/([a-f0-9]{32})/i)
    || cleaned.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (!match) {
    throw new Error('Could not extract page ID from URL');
  }
  return match[1].replace(/-/g, '');
}

export function createNotionClient(token: string): Client {
  return new Client({ auth: token });
}

export async function fetchPageTitle(
  client: Client,
  pageId: string,
): Promise<string> {
  const page = (await client.pages.retrieve({ page_id: pageId })) as PageObjectResponse;
  const titleProp = Object.values(page.properties).find(
    (p) => p.type === 'title',
  );
  if (titleProp && titleProp.type === 'title') {
    return titleProp.title.map((t) => t.plain_text).join('') || 'Untitled';
  }
  return 'Untitled';
}

export async function fetchBlockChildren(
  client: Client,
  blockId: string,
): Promise<BlockObjectResponse[]> {
  const blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    blocks.push(
      ...response.results.filter(
        (b): b is BlockObjectResponse => 'type' in b,
      ),
    );
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return blocks;
}
```

**Step 2: Commit**

```bash
git add src/lib/notion.ts
git commit -m "feat: add Notion API client with page fetcher"
```

---

### Task 4: Content Normalizer

**Files:**
- Create: `src/lib/normalizer.ts`

**Step 1: Write the normalizer**

This walks the raw Notion blocks and produces the `NotionTree` with `NotionNode` entries. Pages become nodes, headings become sub-nodes, text blocks get concatenated.

```typescript
// src/lib/normalizer.ts
import type { Client } from '@notionhq/client';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { fetchBlockChildren, fetchPageTitle } from './notion';
import type { NotionNode, NotionTree } from '@/types';

function extractTextFromBlock(block: BlockObjectResponse): string {
  const b = block as Record<string, unknown>;
  const blockData = b[block.type] as Record<string, unknown> | undefined;
  if (!blockData) return '';

  const richText = blockData.rich_text as Array<{ plain_text: string }> | undefined;
  if (richText && Array.isArray(richText)) {
    return richText.map((t) => t.plain_text).join('');
  }

  // For other block types (e.g., images, embeds), return a placeholder
  if (block.type === 'image') return '[Image]';
  if (block.type === 'video') return '[Video]';
  if (block.type === 'embed') return '[Embed]';
  if (block.type === 'code') {
    const codeData = blockData as Record<string, unknown>;
    const codeText = codeData.rich_text as Array<{ plain_text: string }> | undefined;
    if (codeText) return '```\n' + codeText.map((t) => t.plain_text).join('') + '\n```';
  }
  return '';
}

function isHeading(block: BlockObjectResponse): boolean {
  return ['heading_1', 'heading_2', 'heading_3'].includes(block.type);
}

function headingLevel(block: BlockObjectResponse): number {
  if (block.type === 'heading_1') return 1;
  if (block.type === 'heading_2') return 2;
  if (block.type === 'heading_3') return 3;
  return 0;
}

export async function normalizeNotionPage(
  client: Client,
  rootPageId: string,
): Promise<NotionTree> {
  const nodes: Record<string, NotionNode> = {};

  async function processPage(
    pageId: string,
    parentId: string | null,
  ): Promise<void> {
    const title = await fetchPageTitle(client, pageId);
    const blocks = await fetchBlockChildren(client, pageId);

    const pageNode: NotionNode = {
      id: pageId,
      title,
      content: '',
      type: 'page',
      children: [],
      parentId,
    };

    // Separate blocks into: child pages, headings + content sections
    const contentParts: string[] = [];
    let currentHeadingId: string | null = null;

    for (const block of blocks) {
      // Child page — recurse
      if (block.type === 'child_page') {
        pageNode.children.push(block.id);
        const childTitle = (block as Record<string, unknown>).child_page as { title: string };
        // Create a placeholder and recurse
        nodes[block.id] = {
          id: block.id,
          title: childTitle?.title || 'Untitled',
          content: '',
          type: 'page',
          children: [],
          parentId: pageId,
        };
        await processPage(block.id, pageId);
        continue;
      }

      // Child database — create a node for it
      if (block.type === 'child_database') {
        const dbData = (block as Record<string, unknown>).child_database as { title: string };
        const dbNode: NotionNode = {
          id: block.id,
          title: dbData?.title || 'Database',
          content: '',
          type: 'database',
          children: [],
          parentId: pageId,
        };
        nodes[block.id] = dbNode;
        pageNode.children.push(block.id);
        continue;
      }

      // Heading — create a sub-node
      if (isHeading(block)) {
        const headingText = extractTextFromBlock(block);
        const level = headingLevel(block);
        const headingNode: NotionNode = {
          id: block.id,
          title: headingText,
          content: '',
          type: 'heading',
          children: [],
          parentId: currentHeadingId && level > 1 ? currentHeadingId : pageId,
        };
        nodes[block.id] = headingNode;

        // Add as child of page or parent heading
        if (currentHeadingId && level > 1) {
          nodes[currentHeadingId]?.children.push(block.id);
        } else {
          pageNode.children.push(block.id);
        }

        currentHeadingId = block.id;
        continue;
      }

      // Regular content block — attach to current heading or page
      const text = extractTextFromBlock(block);
      if (text) {
        if (currentHeadingId && nodes[currentHeadingId]) {
          nodes[currentHeadingId].content += (nodes[currentHeadingId].content ? '\n' : '') + text;
        } else {
          contentParts.push(text);
        }
      }

      // Recurse into nested blocks (e.g., toggles, bulleted lists with children)
      if (block.has_children && !['child_page', 'child_database'].includes(block.type)) {
        const childBlocks = await fetchBlockChildren(client, block.id);
        for (const child of childBlocks) {
          const childText = extractTextFromBlock(child);
          if (childText) {
            if (currentHeadingId && nodes[currentHeadingId]) {
              nodes[currentHeadingId].content += '\n' + childText;
            } else {
              contentParts.push(childText);
            }
          }
        }
      }
    }

    pageNode.content = contentParts.join('\n');
    nodes[pageId] = pageNode;
  }

  await processPage(rootPageId, null);

  return { nodes, rootId: rootPageId };
}
```

**Step 2: Commit**

```bash
git add src/lib/normalizer.ts
git commit -m "feat: add Notion content normalizer"
```

---

### Task 5: AI Enrichment Module

**Files:**
- Create: `src/lib/ai.ts`

**Step 1: Write the AI enrichment module**

This sends the NotionTree to Claude and gets back DiagramData with summaries, node types, and suggested cross-links.

```typescript
// src/lib/ai.ts
import Anthropic from '@anthropic-ai/sdk';
import type { NotionTree, DiagramData } from '@/types';

const anthropic = new Anthropic();

export async function enrichWithAI(tree: NotionTree): Promise<DiagramData> {
  // Build a condensed representation for the prompt
  const nodeDescriptions = Object.values(tree.nodes).map((node) => ({
    id: node.id,
    title: node.title,
    type: node.type,
    contentPreview: node.content.slice(0, 500),
    childCount: node.children.length,
    parentId: node.parentId,
  }));

  const prompt = `You are analyzing a Notion page structure to create an interactive diagram.

Here are the nodes extracted from the Notion pages:

${JSON.stringify(nodeDescriptions, null, 2)}

For each node, provide:
1. A concise label (max 6 words) summarizing the node
2. A diagram node type: "topic" (for root/major sections), "subtopic" (for sub-sections), or "detail" (for leaf content)
3. Suggested cross-links to other nodes that are semantically related but not directly connected in the hierarchy (by node ID)

Also generate edges:
- "hierarchy" edges for every parent-child relationship
- "reference" edges for the cross-links you suggest

Return ONLY valid JSON matching this exact schema, with no other text:
{
  "nodes": [
    {
      "id": "string",
      "label": "string",
      "fullContent": "string (use the original node title + content as-is)",
      "type": "topic|subtopic|detail",
      "suggestedLinks": ["nodeId1", "nodeId2"]
    }
  ],
  "edges": [
    {
      "source": "string",
      "target": "string",
      "type": "hierarchy|reference"
    }
  ]
}`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  // Extract JSON from response (handle potential markdown code blocks)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI did not return valid JSON');
  }

  const data: DiagramData = JSON.parse(jsonMatch[0]);
  return data;
}
```

**Step 2: Commit**

```bash
git add src/lib/ai.ts
git commit -m "feat: add AI enrichment module with Claude API"
```

---

### Task 6: Dagre Auto-Layout

**Files:**
- Create: `src/lib/layout.ts`

**Step 1: Write the layout module**

Converts DiagramData into React Flow nodes/edges with positions calculated by dagre.

```typescript
// src/lib/layout.ts
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { DiagramData, DiagramNodeType } from '@/types';

const NODE_DIMENSIONS: Record<DiagramNodeType, { width: number; height: number }> = {
  topic: { width: 220, height: 60 },
  subtopic: { width: 180, height: 50 },
  detail: { width: 150, height: 40 },
};

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

export function layoutDiagram(
  data: DiagramData,
  direction: 'TB' | 'LR' = 'TB',
): LayoutResult {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === 'LR';

  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    edgesep: 20,
  });

  // Add nodes with dimensions
  for (const node of data.nodes) {
    const dims = NODE_DIMENSIONS[node.type] || NODE_DIMENSIONS.detail;
    g.setNode(node.id, { width: dims.width, height: dims.height });
  }

  // Add edges (only hierarchy for layout — reference edges are visual only)
  for (const edge of data.edges) {
    if (edge.type === 'hierarchy') {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const nodes: Node[] = data.nodes.map((node) => {
    const pos = g.node(node.id);
    const dims = NODE_DIMENSIONS[node.type] || NODE_DIMENSIONS.detail;
    return {
      id: node.id,
      type: 'custom',
      position: {
        x: pos.x - dims.width / 2,
        y: pos.y - dims.height / 2,
      },
      data: {
        label: node.label,
        fullContent: node.fullContent,
        nodeType: node.type,
        hasChildren: data.edges.some(
          (e) => e.source === node.id && e.type === 'hierarchy',
        ),
      },
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
    };
  });

  const edges: Edge[] = data.edges.map((edge, i) => ({
    id: `e-${edge.source}-${edge.target}-${i}`,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: edge.type === 'reference',
    style: {
      stroke: edge.type === 'reference' ? '#94a3b8' : '#475569',
      strokeDasharray: edge.type === 'reference' ? '5,5' : undefined,
      strokeWidth: edge.type === 'reference' ? 1 : 2,
    },
  }));

  return { nodes, edges };
}
```

**Step 2: Commit**

```bash
git add src/lib/layout.ts
git commit -m "feat: add dagre auto-layout for diagram"
```

---

### Task 7: API Routes

**Files:**
- Create: `src/app/api/notion/route.ts`
- Create: `src/app/api/generate/route.ts`

**Step 1: Write the Notion fetch API route**

```typescript
// src/app/api/notion/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { extractPageId, createNotionClient } from '@/lib/notion';
import { normalizeNotionPage } from '@/lib/normalizer';

export async function POST(req: NextRequest) {
  try {
    const { pageUrl, token } = await req.json();

    if (!pageUrl || !token) {
      return NextResponse.json(
        { error: 'pageUrl and token are required' },
        { status: 400 },
      );
    }

    const pageId = extractPageId(pageUrl);
    const client = createNotionClient(token);
    const tree = await normalizeNotionPage(client, pageId);

    return NextResponse.json(tree);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Write the generate/enrich API route**

```typescript
// src/app/api/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { enrichWithAI } from '@/lib/ai';
import type { NotionTree } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { tree } = (await req.json()) as { tree: NotionTree };

    if (!tree || !tree.nodes || !tree.rootId) {
      return NextResponse.json(
        { error: 'Valid NotionTree is required' },
        { status: 400 },
      );
    }

    const diagramData = await enrichWithAI(tree);
    return NextResponse.json(diagramData);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/notion/route.ts src/app/api/generate/route.ts
git commit -m "feat: add API routes for Notion fetch and AI enrichment"
```

---

### Task 8: Custom Node Component

**Files:**
- Create: `src/components/CustomNode.tsx`

**Step 1: Write the custom node**

```tsx
// src/components/CustomNode.tsx
'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

type CustomNodeData = {
  label: string;
  fullContent: string;
  nodeType: 'topic' | 'subtopic' | 'detail';
  hasChildren: boolean;
};

const typeStyles = {
  topic: 'bg-blue-600 text-white border-blue-700 text-base font-semibold min-w-[200px]',
  subtopic: 'bg-blue-100 text-blue-900 border-blue-300 text-sm font-medium min-w-[160px]',
  detail: 'bg-gray-50 text-gray-700 border-gray-300 text-xs min-w-[130px]',
};

function CustomNode({ data }: NodeProps) {
  const { label, nodeType } = data as unknown as CustomNodeData;
  const style = typeStyles[nodeType] || typeStyles.detail;

  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 shadow-sm cursor-pointer
        hover:shadow-md transition-shadow text-center ${style}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="truncate max-w-[200px]">{label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
}

export default memo(CustomNode);
```

**Step 2: Commit**

```bash
git add src/components/CustomNode.tsx
git commit -m "feat: add custom diagram node component"
```

---

### Task 9: Detail Panel Component

**Files:**
- Create: `src/components/DetailPanel.tsx`

**Step 1: Write the detail panel**

```tsx
// src/components/DetailPanel.tsx
'use client';

import ReactMarkdown from 'react-markdown';

interface DetailPanelProps {
  title: string;
  content: string;
  onClose: () => void;
}

export default function DetailPanel({ title, content, onClose }: DetailPanelProps) {
  return (
    <div className="fixed right-0 top-0 h-full w-[400px] bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 prose prose-sm max-w-none">
        <ReactMarkdown>{content || '*No content available*'}</ReactMarkdown>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/DetailPanel.tsx
git commit -m "feat: add detail panel for node content"
```

---

### Task 10: Toolbar Component

**Files:**
- Create: `src/components/Toolbar.tsx`

**Step 1: Write the toolbar**

```tsx
// src/components/Toolbar.tsx
'use client';

interface ToolbarProps {
  onFitView: () => void;
  onToggleMinimap: () => void;
  onToggleReferences: () => void;
  onRelayout: (direction: 'TB' | 'LR') => void;
  showMinimap: boolean;
  showReferences: boolean;
}

export default function Toolbar({
  onFitView,
  onToggleMinimap,
  onToggleReferences,
  onRelayout,
  showMinimap,
  showReferences,
}: ToolbarProps) {
  const btn = 'px-3 py-1.5 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors';
  const activeBtn = 'px-3 py-1.5 text-sm rounded border border-blue-400 bg-blue-50 text-blue-700 transition-colors';

  return (
    <div className="flex gap-2 flex-wrap">
      <button className={btn} onClick={onFitView}>Fit View</button>
      <button className={showMinimap ? activeBtn : btn} onClick={onToggleMinimap}>
        Minimap
      </button>
      <button className={showReferences ? activeBtn : btn} onClick={onToggleReferences}>
        References
      </button>
      <button className={btn} onClick={() => onRelayout('TB')}>Vertical</button>
      <button className={btn} onClick={() => onRelayout('LR')}>Horizontal</button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/Toolbar.tsx
git commit -m "feat: add diagram toolbar component"
```

---

### Task 11: Input Form Component

**Files:**
- Create: `src/components/InputForm.tsx`

**Step 1: Write the input form**

```tsx
// src/components/InputForm.tsx
'use client';

import { useState } from 'react';

interface InputFormProps {
  onSubmit: (pageUrl: string, token: string) => void;
  isLoading: boolean;
  loadingStep: string;
}

export default function InputForm({ onSubmit, isLoading, loadingStep }: InputFormProps) {
  const [pageUrl, setPageUrl] = useState('');
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pageUrl.trim() && token.trim()) {
      onSubmit(pageUrl.trim(), token.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-4">
      <div>
        <label htmlFor="pageUrl" className="block text-sm font-medium text-gray-700 mb-1">
          Notion Page URL
        </label>
        <input
          id="pageUrl"
          type="text"
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
          placeholder="https://www.notion.so/Your-Page-abc123..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          disabled={isLoading}
        />
      </div>
      <div>
        <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
          Integration Token
        </label>
        <input
          id="token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ntn_..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          disabled={isLoading}
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !pageUrl.trim() || !token.trim()}
        className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? loadingStep : 'Generate Diagram'}
      </button>
    </form>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/InputForm.tsx
git commit -m "feat: add input form component"
```

---

### Task 12: Diagram Canvas Component

**Files:**
- Create: `src/components/DiagramCanvas.tsx`

**Step 1: Write the main diagram canvas**

This is the core component that ties React Flow, custom nodes, detail panel, and toolbar together.

```tsx
// src/components/DiagramCanvas.tsx
'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Background,
  Panel,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CustomNode from './CustomNode';
import DetailPanel from './DetailPanel';
import Toolbar from './Toolbar';
import { layoutDiagram } from '@/lib/layout';
import type { DiagramData } from '@/types';

const nodeTypes = { custom: CustomNode };

interface DiagramCanvasInnerProps {
  diagramData: DiagramData;
}

function DiagramCanvasInner({ diagramData }: DiagramCanvasInnerProps) {
  const { fitView } = useReactFlow();

  const initialLayout = useMemo(
    () => layoutDiagram(diagramData, 'TB'),
    [diagramData],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialLayout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialLayout.edges);
  const [selectedNode, setSelectedNode] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showReferences, setShowReferences] = useState(true);

  const visibleEdges = useMemo(() => {
    if (showReferences) return edges;
    return edges.filter((e) => !e.animated);
  }, [edges, showReferences]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const data = node.data as { label: string; fullContent: string };
    setSelectedNode({ title: data.label, content: data.fullContent });
  }, []);

  const onRelayout = useCallback(
    (direction: 'TB' | 'LR') => {
      const result = layoutDiagram(diagramData, direction);
      setNodes(result.nodes);
      setEdges(result.edges);
      setTimeout(() => fitView({ padding: 0.2 }), 50);
    },
    [diagramData, setNodes, setEdges, fitView],
  );

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />
        {showMinimap && <MiniMap />}
        <Panel position="top-left">
          <Toolbar
            onFitView={() => fitView({ padding: 0.2 })}
            onToggleMinimap={() => setShowMinimap((v) => !v)}
            onToggleReferences={() => setShowReferences((v) => !v)}
            onRelayout={onRelayout}
            showMinimap={showMinimap}
            showReferences={showReferences}
          />
        </Panel>
      </ReactFlow>
      {selectedNode && (
        <DetailPanel
          title={selectedNode.title}
          content={selectedNode.content}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

export default function DiagramCanvas({ diagramData }: { diagramData: DiagramData }) {
  return (
    <ReactFlowProvider>
      <DiagramCanvasInner diagramData={diagramData} />
    </ReactFlowProvider>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/DiagramCanvas.tsx
git commit -m "feat: add diagram canvas with React Flow integration"
```

---

### Task 13: Landing Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Write the landing page**

Replace the default Next.js page with our landing page that shows the form and transitions to the diagram view.

```tsx
// src/app/page.tsx
'use client';

import { useState } from 'react';
import InputForm from '@/components/InputForm';
import DiagramCanvas from '@/components/DiagramCanvas';
import type { DiagramData } from '@/types';

export default function Home() {
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (pageUrl: string, token: string) => {
    setIsLoading(true);
    setError('');
    setDiagramData(null);

    try {
      // Step 1: Fetch and normalize Notion content
      setLoadingStep('Fetching Notion pages...');
      const notionRes = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageUrl, token }),
      });

      if (!notionRes.ok) {
        const err = await notionRes.json();
        throw new Error(err.error || 'Failed to fetch Notion pages');
      }

      const tree = await notionRes.json();

      // Step 2: AI enrichment
      setLoadingStep('Analyzing content with AI...');
      const generateRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tree }),
      });

      if (!generateRes.ok) {
        const err = await generateRes.json();
        throw new Error(err.error || 'Failed to generate diagram');
      }

      const data: DiagramData = await generateRes.json();

      // Step 3: Render
      setLoadingStep('Generating diagram...');
      setDiagramData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  // Diagram view
  if (diagramData) {
    return (
      <div className="w-screen h-screen flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
          <h1 className="text-sm font-semibold text-gray-700">Notion to Diagram</h1>
          <button
            onClick={() => setDiagramData(null)}
            className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 text-gray-600"
          >
            New Diagram
          </button>
        </div>
        <div className="flex-1">
          <DiagramCanvas diagramData={diagramData} />
        </div>
      </div>
    );
  }

  // Landing page
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Notion to Diagram</h1>
        <p className="text-gray-500 text-sm max-w-md">
          Transform your Notion pages into interactive diagrams. Paste a page URL and your integration token to get started.
        </p>
      </div>
      <InputForm onSubmit={handleSubmit} isLoading={isLoading} loadingStep={loadingStep} />
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm max-w-lg">
          {error}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add landing page with form and diagram view"
```

---

### Task 14: Layout and Global Styles

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Step 1: Update layout.tsx**

Ensure the layout is minimal — just the html/body wrapper with metadata.

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Notion to Diagram',
  description: 'Transform Notion pages into interactive diagrams',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

**Step 2: Update globals.css**

Keep it minimal — just Tailwind directives and any React Flow overrides.

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  padding: 0;
}

.react-flow__node-custom {
  font-family: inherit;
}
```

**Step 3: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: update layout and global styles"
```

---

### Task 15: Remove Unused Scaffold Files and Final Verification

**Files:**
- Delete: `src/app/diagram/page.tsx` (not needed — we use single-page approach)
- Delete: any default Next.js page content/images that shipped with create-next-app

**Step 1: Clean up scaffold artifacts**

Remove default Next.js images and any unused files generated by create-next-app (like `public/vercel.svg`, `public/next.svg`, etc).

**Step 2: Verify the build**

Run:
```bash
npm run build
```

Expected: Build completes with no errors.

**Step 3: Manual smoke test**

Run:
```bash
npm run dev
```

1. Open `http://localhost:3000`
2. Verify landing page renders with form
3. (If you have a Notion token) submit a real page URL and verify diagram generates

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: clean up scaffold files, verify build"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Project scaffolding | package.json, next.config.ts, etc. |
| 2 | Type definitions | `src/types/index.ts` |
| 3 | Notion API client | `src/lib/notion.ts` |
| 4 | Content normalizer | `src/lib/normalizer.ts` |
| 5 | AI enrichment | `src/lib/ai.ts` |
| 6 | Dagre auto-layout | `src/lib/layout.ts` |
| 7 | API routes | `src/app/api/notion/route.ts`, `src/app/api/generate/route.ts` |
| 8 | Custom node component | `src/components/CustomNode.tsx` |
| 9 | Detail panel | `src/components/DetailPanel.tsx` |
| 10 | Toolbar | `src/components/Toolbar.tsx` |
| 11 | Input form | `src/components/InputForm.tsx` |
| 12 | Diagram canvas | `src/components/DiagramCanvas.tsx` |
| 13 | Landing page | `src/app/page.tsx` |
| 14 | Layout + styles | `src/app/layout.tsx`, `src/app/globals.css` |
| 15 | Cleanup + verify | Remove scaffold, build check |
