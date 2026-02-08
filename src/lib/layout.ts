import { Position, type Node, type Edge } from '@xyflow/react';
import type { DiagramData, DiagramNodeType } from '@/types';

const NODE_DIMENSIONS: Record<DiagramNodeType, { width: number; height: number }> = {
  topic: { width: 260, height: 50 },
  subtopic: { width: 240, height: 60 },
  detail: { width: 220, height: 55 },
};

const H_GAP = 50;
const V_GAP = 60;
const RING_GAP = 200;

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

export type LayoutDirection = 'TB' | 'LR' | 'RADIAL';

/** Map an angle (radians) to the nearest cardinal Position. */
function angleToPosition(angle: number): Position {
  // Normalize to [0, 2π)
  const a = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  // Quadrants: right=[−π/4,π/4], bottom=[π/4,3π/4], left=[3π/4,5π/4], top=[5π/4,7π/4]
  if (a < Math.PI / 4 || a >= (7 * Math.PI) / 4) return Position.Right;
  if (a < (3 * Math.PI) / 4) return Position.Bottom;
  if (a < (5 * Math.PI) / 4) return Position.Left;
  return Position.Top;
}

interface RadialNodeInfo {
  x: number;
  y: number;
  sourcePos: Position;
  targetPos: Position;
}

const NODE_PAD = 40;

interface SubtreeInfo {
  node: TreeNode;
  minAngle: number;
  children: SubtreeInfo[];
}

/**
 * Bottom-up pass: compute the minimum angular width each subtree needs
 * so that no two nodes at the same depth overlap.
 * For a leaf at depth d: minAngle = (nodeDiagonal + padding) / radius
 * For an internal node: max(self minAngle, sum of children minAngles)
 */
function computeMinAngles(
  node: TreeNode,
  depth: number,
  ringGap: number,
): SubtreeInfo {
  const nodeDim = Math.max(node.width, node.height);
  const radius = Math.max(depth, 1) * ringGap;
  const selfMinAngle = depth === 0 ? 0 : (nodeDim + NODE_PAD) / radius;

  const childInfos = node.children.map((c) =>
    computeMinAngles(c, depth + 1, ringGap),
  );
  const childrenMinAngle = childInfos.reduce((sum, c) => sum + c.minAngle, 0);

  return {
    node,
    minAngle: Math.max(selfMinAngle, childrenMinAngle),
    children: childInfos,
  };
}

/**
 * Position nodes radially: root at center, children in concentric rings.
 * Angular allocation is based on minimum-width requirements so nodes
 * never overlap. Ring gap is scaled up automatically if the tree is too wide.
 */
function layoutRadial(trees: TreeNode[]): Map<string, RadialNodeInfo> {
  const result = new Map<string, RadialNodeInfo>();

  // Step 1: compute min angles with base RING_GAP
  let ringGap = RING_GAP;
  let infos = trees.map((t) => computeMinAngles(t, 0, ringGap));
  let totalMin = infos.reduce((sum, s) => sum + Math.max(s.minAngle, 0.1), 0);

  // Step 2: if it doesn't fit in a full circle, scale ring gap up
  if (totalMin > 2 * Math.PI) {
    ringGap = ringGap * (totalMin / (2 * Math.PI));
    infos = trees.map((t) => computeMinAngles(t, 0, ringGap));
    totalMin = infos.reduce((sum, s) => sum + Math.max(s.minAngle, 0.1), 0);
  }

  // Step 3: top-down placement using minAngle proportions
  function placeSubtree(
    info: SubtreeInfo,
    depth: number,
    startAngle: number,
    endAngle: number,
  ) {
    const midAngle = (startAngle + endAngle) / 2;

    if (depth === 0) {
      result.set(info.node.id, {
        x: 0,
        y: 0,
        sourcePos: Position.Bottom,
        targetPos: Position.Top,
      });
    } else {
      const radius = depth * ringGap;
      const x = radius * Math.cos(midAngle);
      const y = radius * Math.sin(midAngle);
      const targetPos = angleToPosition(midAngle + Math.PI);
      const sourcePos = angleToPosition(midAngle);
      result.set(info.node.id, { x, y, sourcePos, targetPos });
    }

    if (info.children.length === 0) return;

    const totalChildMin = info.children.reduce(
      (sum, c) => sum + c.minAngle,
      0,
    );
    const angleSpan = endAngle - startAngle;
    let currentAngle = startAngle;

    for (const child of info.children) {
      const childSpan =
        totalChildMin > 0
          ? (child.minAngle / totalChildMin) * angleSpan
          : angleSpan / info.children.length;
      placeSubtree(child, depth + 1, currentAngle, currentAngle + childSpan);
      currentAngle += childSpan;
    }
  }

  if (infos.length === 1) {
    placeSubtree(infos[0], 0, 0, 2 * Math.PI);
  } else {
    let currentAngle = 0;
    for (const info of infos) {
      const span = (Math.max(info.minAngle, 0.1) / totalMin) * 2 * Math.PI;
      placeSubtree(info, 0, currentAngle, currentAngle + span);
      currentAngle += span;
    }
  }

  return result;
}

export function layoutDiagram(
  data: DiagramData,
  direction: LayoutDirection = 'TB',
): LayoutResult {
  const isHorizontal = direction === 'LR';
  const isRadial = direction === 'RADIAL';
  const trees = buildTree(data);

  let radialPositions: Map<string, RadialNodeInfo> | null = null;

  if (isRadial) {
    radialPositions = layoutRadial(trees);
  } else {
    let offsetX = 0;
    for (const tree of trees) {
      positionTree(tree, offsetX, 0);
      offsetX += tree.subtreeWidth + H_GAP * 2;
    }
  }

  const treePositions = new Map<string, { x: number; y: number }>();
  if (!isRadial) {
    for (const tree of trees) {
      collectNodes(tree, treePositions);
    }
  }

  const nodes: Node[] = data.nodes.map((node) => {
    if (isRadial && radialPositions) {
      const info = radialPositions.get(node.id) || {
        x: 0, y: 0, sourcePos: Position.Bottom, targetPos: Position.Top,
      };
      return {
        id: node.id,
        type: 'custom',
        position: { x: info.x, y: info.y },
        data: {
          label: node.label,
          fullContent: node.fullContent,
          nodeType: node.type,
          hasChildren: data.edges.some(
            (e) => e.source === node.id && e.type === 'hierarchy',
          ),
          sourcePos: info.sourcePos,
          targetPos: info.targetPos,
        },
        sourcePosition: info.sourcePos,
        targetPosition: info.targetPos,
      };
    }

    const pos = treePositions.get(node.id) || { x: 0, y: 0 };
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
        sourcePos: isHorizontal ? Position.Right : Position.Bottom,
        targetPos: isHorizontal ? Position.Left : Position.Top,
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
