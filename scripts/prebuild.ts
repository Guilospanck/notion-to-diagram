import { createNotionClient } from '../src/lib/notion';
import { normalizeNotionPage } from '../src/lib/normalizer';
import { generateDiagram } from '../src/lib/diagram';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const token = process.env.NOTION_TOKEN;
const pageId = process.env.NOTION_PAGE_ID;

if (!token || !pageId) {
  console.log('NOTION_TOKEN and NOTION_PAGE_ID not set, skipping prebuild');
  process.exit(0);
}

const client = createNotionClient(token);
const tree = await normalizeNotionPage(client, pageId);
const diagram = generateDiagram(tree);

mkdirSync(join(process.cwd(), 'public'), { recursive: true });
writeFileSync(
  join(process.cwd(), 'public', 'diagram-data.json'),
  JSON.stringify(diagram),
);
console.log(`Prebuild: wrote ${diagram.nodes.length} nodes to public/diagram-data.json`);
