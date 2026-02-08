import Anthropic from '@anthropic-ai/sdk';
import type { NotionTree, DiagramData, DiagramNode, DiagramEdge, DiagramNodeType } from '@/types';

export function generateRuleBased(tree: NotionTree): DiagramData {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  function getNodeType(node: { type: string; children: string[] }, depth: number): DiagramNodeType {
    if (depth === 0) return 'topic';
    if (node.children.length > 0 || node.type === 'page') return 'subtopic';
    return 'detail';
  }

  function truncateLabel(title: string, maxWords: number = 6): string {
    const words = title.split(/\s+/);
    if (words.length <= maxWords) return title;
    return words.slice(0, maxWords).join(' ') + '...';
  }

  function walk(nodeId: string, depth: number) {
    const node = tree.nodes[nodeId];
    if (!node) return;

    nodes.push({
      id: node.id,
      label: truncateLabel(node.title),
      fullContent: node.title + (node.content ? '\n\n' + node.content : ''),
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

function hasValidApiKey(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && key !== 'your-anthropic-api-key-here' && key.startsWith('sk-ant-');
}

export async function enrichWithAI(tree: NotionTree): Promise<DiagramData> {
  if (!hasValidApiKey()) {
    return generateRuleBased(tree);
  }

  try {
  const anthropic = new Anthropic();

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

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI did not return valid JSON');
  }

  const data: DiagramData = JSON.parse(jsonMatch[0]);
  return data;
  } catch {
    // Fall back to rule-based if AI call fails (auth error, rate limit, etc.)
    return generateRuleBased(tree);
  }
}
