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

