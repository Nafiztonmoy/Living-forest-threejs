import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(TOOLS);
const DIST = path.join(ROOT, 'dist');

await rm(DIST, { recursive: true, force: true });
await mkdir(path.join(DIST, 'src'), { recursive: true });
await cp(path.join(ROOT, 'index.html'), path.join(DIST, 'index.html'));
await cp(path.join(ROOT, 'style.css'), path.join(DIST, 'style.css'));
await cp(path.join(ROOT, 'src'), path.join(DIST, 'src'), { recursive: true });

console.log(`Built multi-file deployable project at: ${DIST}`);
