import { createNotionClient } from '../src/lib/notion';
import { normalizeNotionPage } from '../src/lib/normalizer';
import { generateDiagram } from '../src/lib/diagram';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Load .env file if it exists (for local dev; CI sets env vars directly)
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

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
