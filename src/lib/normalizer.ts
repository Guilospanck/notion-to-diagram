import type { Client } from '@notionhq/client';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { fetchBlockChildren, fetchPageTitle } from './notion';
import type { NotionNode, NotionTree } from '@/types';

// --- Rich text types ---

interface RichTextItem {
  type: string;
  plain_text: string;
  href: string | null;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
  };
  mention?: {
    type: string;
    page?: { id: string };
    database?: { id: string };
  };
}

// --- Rich text → Markdown ---

function richTextToMarkdown(richText: RichTextItem[] | undefined): string {
  if (!richText || !Array.isArray(richText)) return '';
  return richText
    .map((t) => {
      let text = t.plain_text;
      if (!text) return '';

      // Handle page mentions — preserve as notion link for post-processing
      if (t.type === 'mention' && t.mention?.type === 'page' && t.mention.page) {
        const id = t.mention.page.id.replace(/-/g, '');
        return `[${text}](#notion:${id})`;
      }

      if (t.annotations.code) text = `\`${text}\``;
      if (t.annotations.bold) text = `**${text}**`;
      if (t.annotations.italic) text = `*${text}*`;
      if (t.annotations.strikethrough) text = `~~${text}~~`;

      if (t.href) {
        text = `[${text}](${t.href})`;
      }
      return text;
    })
    .join('');
}

// --- Block → Markdown line(s) ---

function getRichText(block: BlockObjectResponse): RichTextItem[] {
  const b = block as Record<string, unknown>;
  const blockData = b[block.type] as Record<string, unknown> | undefined;
  if (!blockData) return [];
  return (blockData.rich_text as RichTextItem[] | undefined) || [];
}

function blockToMarkdown(block: BlockObjectResponse): string {
  const text = richTextToMarkdown(getRichText(block));
  const b = block as Record<string, unknown>;
  const blockData = b[block.type] as Record<string, unknown> | undefined;

  switch (block.type) {
    case 'paragraph':
      return text;
    case 'bulleted_list_item':
      return `- ${text}`;
    case 'numbered_list_item':
      return `1. ${text}`;
    case 'to_do': {
      const checked = blockData?.checked === true;
      return `- [${checked ? 'x' : ' '}] ${text}`;
    }
    case 'quote':
      return `> ${text}`;
    case 'callout': {
      const icon = blockData?.icon as { type: string; emoji?: string } | undefined;
      const emoji = icon?.type === 'emoji' ? icon.emoji + ' ' : '';
      return `> ${emoji}${text}`;
    }
    case 'code': {
      const lang = (blockData?.language as string) || '';
      const plain = getRichText(block).map((t) => t.plain_text).join('');
      return `\`\`\`${lang}\n${plain}\n\`\`\``;
    }
    case 'divider':
      return '---';
    case 'toggle':
      return `**${text}**`;
    case 'bookmark': {
      const url = (blockData?.url as string) || '';
      return text ? `[${text}](${url})` : url;
    }
    case 'image': {
      const imgData = blockData as Record<string, unknown> | undefined;
      const caption = richTextToMarkdown(imgData?.caption as RichTextItem[] | undefined);
      return caption ? `[Image: ${caption}]` : '[Image]';
    }
    case 'video':
      return '[Video]';
    case 'embed':
      return '[Embed]';
    case 'table_of_contents':
      return '';
    case 'breadcrumb':
      return '';
    default:
      return text;
  }
}

// --- Heading detection ---

function isHeading(block: BlockObjectResponse): boolean {
  return ['heading_1', 'heading_2', 'heading_3'].includes(block.type);
}

function headingLevel(block: BlockObjectResponse): number {
  if (block.type === 'heading_1') return 1;
  if (block.type === 'heading_2') return 2;
  if (block.type === 'heading_3') return 3;
  return 0;
}

function isListLine(line: string): boolean {
  return /^(\s*[-*]|\s*\d+\.)/.test(line);
}

// --- Notion URL → internal link post-processing ---

/** Extract a 32-hex Notion page ID from a URL */
function extractNotionId(url: string): string | null {
  const match = url.match(/([a-f0-9]{32})/i)
    || url.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (!match) return null;
  return match[1].replace(/-/g, '');
}

function rewriteInternalLinks(content: string, knownIds: Set<string>): string {
  // Convert #notion:<id> mention links to #node:<id> if known
  content = content.replace(
    /\[([^\]]+)\]\(#notion:([a-f0-9]+)\)/gi,
    (match, text, id) => knownIds.has(id) ? `[${text}](#node:${id})` : text,
  );

  // Convert Notion URLs to internal links if the page ID is a known node
  content = content.replace(
    /\[([^\]]+)\]\((https?:\/\/(?:www\.)?notion\.so\/[^)]+)\)/gi,
    (match, text, url) => {
      const id = extractNotionId(url);
      if (id && knownIds.has(id)) return `[${text}](#node:${id})`;
      return match;
    },
  );

  return content;
}

// --- Main normalizer ---

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
    const headingByLevel: Record<number, string> = {};

    function currentDeepestHeading(): string | null {
      for (let l = 3; l >= 1; l--) {
        if (headingByLevel[l]) return headingByLevel[l];
      }
      return null;
    }

    function appendContent(text: string) {
      if (!text) return;
      const headingId = currentDeepestHeading();
      if (headingId && nodes[headingId]) {
        const existing = nodes[headingId].content;
        const sep = existing && isListLine(text) && isListLine(existing.split('\n').pop() || '') ? '\n' : '\n\n';
        nodes[headingId].content += (existing ? sep : '') + text;
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
        const headingText = richTextToMarkdown(getRichText(block));
        const level = headingLevel(block);

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

        headingByLevel[level] = block.id;
        for (let l = level + 1; l <= 3; l++) {
          delete headingByLevel[l];
        }
        continue;
      }

      // --- Table: fetch rows and build markdown table ---
      if (block.type === 'table') {
        const tableData = (block as Record<string, unknown>).table as {
          has_column_header?: boolean;
        } | undefined;
        const hasHeader = tableData?.has_column_header ?? true;
        const rows = await fetchBlockChildren(client, block.id);
        const tableLines: string[] = [];

        for (let ri = 0; ri < rows.length; ri++) {
          const row = rows[ri];
          const rowData = (row as Record<string, unknown>).table_row as {
            cells: RichTextItem[][];
          } | undefined;
          if (!rowData?.cells) continue;

          const cells = rowData.cells.map((cell) => richTextToMarkdown(cell));
          tableLines.push('| ' + cells.join(' | ') + ' |');

          // Add separator after header row
          if (ri === 0 && hasHeader) {
            tableLines.push('| ' + cells.map(() => '---').join(' | ') + ' |');
          }
        }

        if (tableLines.length > 0) {
          appendContent(tableLines.join('\n'));
        }
        continue;
      }

      // --- Column list: process each column's blocks sequentially ---
      if (block.type === 'column_list') {
        const columns = await fetchBlockChildren(client, block.id);
        for (const column of columns) {
          if (column.type === 'column' && column.has_children) {
            const colBlocks = await fetchBlockChildren(client, column.id);
            for (const colBlock of colBlocks) {
              if (isHeading(colBlock)) {
                appendContent(richTextToMarkdown(getRichText(colBlock)));
              } else if (colBlock.type === 'table') {
                // Nested table inside column
                const tData = (colBlock as Record<string, unknown>).table as {
                  has_column_header?: boolean;
                } | undefined;
                const tHasHeader = tData?.has_column_header ?? true;
                const tRows = await fetchBlockChildren(client, colBlock.id);
                const tLines: string[] = [];
                for (let ri = 0; ri < tRows.length; ri++) {
                  const row = tRows[ri];
                  const rowData = (row as Record<string, unknown>).table_row as {
                    cells: RichTextItem[][];
                  } | undefined;
                  if (!rowData?.cells) continue;
                  const cells = rowData.cells.map((cell) => richTextToMarkdown(cell));
                  tLines.push('| ' + cells.join(' | ') + ' |');
                  if (ri === 0 && tHasHeader) {
                    tLines.push('| ' + cells.map(() => '---').join(' | ') + ' |');
                  }
                }
                if (tLines.length > 0) appendContent(tLines.join('\n'));
              } else {
                const colMd = blockToMarkdown(colBlock);
                appendContent(colMd);
              }
            }
          }
        }
        continue;
      }

      const md = blockToMarkdown(block);
      appendContent(md);

      // Recurse into nested blocks (toggle children, list sub-items, etc.)
      if (block.has_children && !['child_page', 'child_database'].includes(block.type)) {
        const childBlocks = await fetchBlockChildren(client, block.id);
        for (const child of childBlocks) {
          if (isHeading(child)) {
            appendContent(richTextToMarkdown(getRichText(child)));
          } else {
            const childMd = blockToMarkdown(child);
            if (['bulleted_list_item', 'numbered_list_item', 'to_do'].includes(child.type)) {
              appendContent('  ' + childMd);
            } else {
              appendContent(childMd);
            }
          }
        }
      }
    }

    let joined = '';
    for (let i = 0; i < contentParts.length; i++) {
      if (i === 0) {
        joined = contentParts[i];
      } else {
        const sep = isListLine(contentParts[i]) && isListLine(contentParts[i - 1]) ? '\n' : '\n\n';
        joined += sep + contentParts[i];
      }
    }
    pageNode.content = joined;
    nodes[pageId] = pageNode;
  }

  await processPage(rootPageId, null);

  // Post-process: rewrite Notion URLs and mentions to internal #node: links
  const knownIds = new Set(Object.keys(nodes));
  for (const node of Object.values(nodes)) {
    if (node.content) {
      node.content = rewriteInternalLinks(node.content, knownIds);
    }
  }

  return { nodes, rootId: rootPageId };
}
