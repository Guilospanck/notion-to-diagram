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
    let currentHeadingId: string | null = null;

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
        const headingNode: NotionNode = {
          id: block.id,
          title: headingText,
          content: '',
          type: 'heading',
          children: [],
          parentId: currentHeadingId && level > 1 ? currentHeadingId : pageId,
        };
        nodes[block.id] = headingNode;

        if (currentHeadingId && level > 1) {
          nodes[currentHeadingId]?.children.push(block.id);
        } else {
          pageNode.children.push(block.id);
        }

        currentHeadingId = block.id;
        continue;
      }

      const text = extractTextFromBlock(block);
      if (text) {
        if (currentHeadingId && nodes[currentHeadingId]) {
          nodes[currentHeadingId].content += (nodes[currentHeadingId].content ? '\n' : '') + text;
        } else {
          contentParts.push(text);
        }
      }

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
