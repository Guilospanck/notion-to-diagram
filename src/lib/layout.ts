import { Position, type Node, type Edge } from '@xyflow/react';
import type { DiagramData, DiagramNodeType } from '@/types';

const NODE_DIMENSIONS: Record<DiagramNodeType, { width: number; height: number }> = {
  topic: { width: 260, height: 50 },
  subtopic: { width: 240, height: 60 },
  detail: { width: 220, height: 55 },
};

const H_GAP = 50;
const V_GAP = 60;

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

interface TreeNode {
  id: string;
  children: TreeNode[];
  width: number;
  height: number;
  subtreeWidth: number;
  x: number;
  y: number;
}

function buildTree(data: DiagramData): TreeNode[] {
  const childMap = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const edge of data.edges) {
    if (edge.type === 'hierarchy') {
      if (!childMap.has(edge.source)) childMap.set(edge.source, []);
      childMap.get(edge.source)!.push(edge.target);
      hasParent.add(edge.target);
    }
  }

  const nodeTypeMap = new Map(data.nodes.map((n) => [n.id, n.type]));

  function build(id: string): TreeNode {
    const type = nodeTypeMap.get(id) || 'detail';
    const dims = NODE_DIMENSIONS[type];
    const childIds = childMap.get(id) || [];
    const children = childIds.map(build);
    const childrenWidth = children.length > 0
      ? children.reduce((sum, c) => sum + c.subtreeWidth, 0) + (children.length - 1) * H_GAP
      : 0;
    return {
      id,
      children,
      width: dims.width,
      height: dims.height,
      subtreeWidth: Math.max(dims.width, childrenWidth),
      x: 0,
      y: 0,
    };
  }

  const roots = data.nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id);
  return roots.map(build);
}

function positionTree(tree: TreeNode, x: number, y: number) {
  tree.x = x + tree.subtreeWidth / 2 - tree.width / 2;
  tree.y = y;

  let childX = x;
  for (const child of tree.children) {
    positionTree(child, childX, y + tree.height + V_GAP);
    childX += child.subtreeWidth + H_GAP;
  }
}

function collectNodes(tree: TreeNode, nodeMap: Map<string, { x: number; y: number }>) {
  nodeMap.set(tree.id, { x: tree.x, y: tree.y });
  for (const child of tree.children) {
    collectNodes(child, nodeMap);
  }
}

export function layoutDiagram(
  data: DiagramData,
  direction: 'TB' | 'LR' = 'TB',
): LayoutResult {
  const isHorizontal = direction === 'LR';
  const trees = buildTree(data);

  let offsetX = 0;
  for (const tree of trees) {
    positionTree(tree, offsetX, 0);
    offsetX += tree.subtreeWidth + H_GAP * 2;
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const tree of trees) {
    collectNodes(tree, positions);
  }

  const nodes: Node[] = data.nodes.map((node) => {
    const pos = positions.get(node.id) || { x: 0, y: 0 };
    return {
      id: node.id,
      type: 'custom',
      position: isHorizontal ? { x: pos.y, y: pos.x } : pos,
      data: {
        label: node.label,
        fullContent: node.fullContent,
        nodeType: node.type,
        hasChildren: data.edges.some(
          (e) => e.source === node.id && e.type === 'hierarchy',
        ),
      },
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
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
