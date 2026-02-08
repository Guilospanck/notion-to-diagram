// src/lib/notion.ts
import { Client } from '@notionhq/client';
import type {
  BlockObjectResponse,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';

export function extractPageId(url: string): string {
  const cleaned = url.split('?')[0].split('#')[0];
  const match = cleaned.match(/([a-f0-9]{32})/i)
    || cleaned.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (!match) {
    throw new Error('Could not extract page ID from URL');
  }
  return match[1].replace(/-/g, '');
}

export function createNotionClient(token: string): Client {
  return new Client({ auth: token });
}

export async function fetchPageTitle(
  client: Client,
  pageId: string,
): Promise<string> {
  const page = (await client.pages.retrieve({ page_id: pageId })) as PageObjectResponse;
  const titleProp = Object.values(page.properties).find(
    (p) => p.type === 'title',
  );
  if (titleProp && titleProp.type === 'title') {
    return titleProp.title.map((t) => t.plain_text).join('') || 'Untitled';
  }
  return 'Untitled';
}

export async function fetchBlockChildren(
  client: Client,
  blockId: string,
): Promise<BlockObjectResponse[]> {
  const blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    blocks.push(
      ...response.results.filter(
        (b): b is BlockObjectResponse => 'type' in b,
      ),
    );
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return blocks;
}
