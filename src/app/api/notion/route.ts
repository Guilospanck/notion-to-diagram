import { NextRequest, NextResponse } from 'next/server';
import { extractPageId, createNotionClient } from '@/lib/notion';
import { normalizeNotionPage } from '@/lib/normalizer';

export async function POST(req: NextRequest) {
  try {
    const { pageUrl, token } = await req.json();

    if (!pageUrl || !token) {
      return NextResponse.json(
        { error: 'pageUrl and token are required' },
        { status: 400 },
      );
    }

    const pageId = extractPageId(pageUrl);
    const client = createNotionClient(token);
    const tree = await normalizeNotionPage(client, pageId);

    return NextResponse.json(tree);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
