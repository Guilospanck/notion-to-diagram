import { Position, type Node, type Edge } from '@xyflow/react';
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

export async function layoutDiagram(
  data: DiagramData,
  direction: 'TB' | 'LR' = 'TB',
): Promise<LayoutResult> {
  const dagre = (await import('@dagrejs/dagre')).default;
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === 'LR';

  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    edgesep: 20,
  });

  for (const node of data.nodes) {
    const dims = NODE_DIMENSIONS[node.type] || NODE_DIMENSIONS.detail;
    g.setNode(node.id, { width: dims.width, height: dims.height });
  }

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
