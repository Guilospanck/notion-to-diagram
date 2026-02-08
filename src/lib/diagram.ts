import type {
  NotionTree,
  DiagramData,
  DiagramNode,
  DiagramEdge,
  DiagramNodeType,
} from '@/types';

function getNodeType(
  node: { type: string; children: string[] },
  depth: number,
): DiagramNodeType {
  if (depth === 0) return 'topic';
  if (node.children.length > 0 || node.type === 'page') return 'subtopic';
  return 'detail';
}

function truncateLabel(title: string, maxWords: number = 10): string {
  const words = title.split(/\s+/);
  if (words.length <= maxWords) return title;
  return words.slice(0, maxWords).join(' ') + '...';
}

export function generateDiagram(tree: NotionTree): DiagramData {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  function walk(nodeId: string, depth: number) {
    const node = tree.nodes[nodeId];
    if (!node) return;

    nodes.push({
      id: node.id,
      label: truncateLabel(node.title),
      fullContent: node.content || '',
      type: getNodeType(node, depth),
      suggestedLinks: [],
    });

    for (const childId of node.children) {
      edges.push({ source: node.id, target: childId, type: 'hierarchy' });
      walk(childId, depth + 1);
    }
  }

  walk(tree.rootId, 0);

  return { nodes, edges };
}
