import { NextRequest, NextResponse } from 'next/server';
import { enrichWithAI } from '@/lib/ai';
import type { NotionTree } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { tree } = (await req.json()) as { tree: NotionTree };

    if (!tree || !tree.nodes || !tree.rootId) {
      return NextResponse.json(
        { error: 'Valid NotionTree is required' },
        { status: 400 },
      );
    }

    const diagramData = await enrichWithAI(tree);
    return NextResponse.json(diagramData);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
