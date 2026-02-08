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

    const contentParts: string[] = [];
    // Track the most recent heading at each level (1, 2, 3)
    const headingByLevel: Record<number, string> = {};

    function currentDeepestHeading(): string | null {
      for (let l = 3; l >= 1; l--) {
        if (headingByLevel[l]) return headingByLevel[l];
      }
      return null;
    }

    function appendContent(text: string) {
      const headingId = currentDeepestHeading();
      if (headingId && nodes[headingId]) {
        nodes[headingId].content += (nodes[headingId].content ? '\n' : '') + text;
      } else {
        contentParts.push(text);
      }
    }

    for (const block of blocks) {
      if (block.type === 'child_page') {
        pageNode.children.push(block.id);
        const childTitle = (block as Record<string, unknown>).child_page as { title: string };
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

      if (isHeading(block)) {
        const headingText = extractTextFromBlock(block);
        const level = headingLevel(block);

        // Find parent: nearest heading with a lower level, or the page itself
        let parentNodeId = pageId;
        for (let l = level - 1; l >= 1; l--) {
          if (headingByLevel[l]) {
            parentNodeId = headingByLevel[l];
            break;
          }
        }

        const headingNode: NotionNode = {
          id: block.id,
          title: headingText,
          content: '',
          type: 'heading',
          children: [],
          parentId: parentNodeId,
        };
        nodes[block.id] = headingNode;

        if (parentNodeId === pageId) {
          pageNode.children.push(block.id);
        } else {
          nodes[parentNodeId]?.children.push(block.id);
        }

        // Update stack: set this level, clear all deeper levels
        headingByLevel[level] = block.id;
        for (let l = level + 1; l <= 3; l++) {
          delete headingByLevel[l];
        }
        continue;
      }

      const text = extractTextFromBlock(block);
      if (text) {
        appendContent(text);
      }

      if (block.has_children && !['child_page', 'child_database'].includes(block.type)) {
        const childBlocks = await fetchBlockChildren(client, block.id);
        for (const child of childBlocks) {
          const childText = extractTextFromBlock(child);
          if (childText) {
            appendContent(childText);
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
