// src/lib/ai.ts
import Anthropic from '@anthropic-ai/sdk';
import type { NotionTree, DiagramData } from '@/types';

const anthropic = new Anthropic();

export async function enrichWithAI(tree: NotionTree): Promise<DiagramData> {
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
}
