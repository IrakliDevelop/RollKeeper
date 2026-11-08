import 'server-only';
import { readFile } from 'fs/promises';
import path from 'path';
import { parseRoadmap, type Roadmap } from './parseRoadmap';

const ROADMAP_PATH = path.join(process.cwd(), 'content', 'roadmap.md');

/**
 * Reads and parses `content/roadmap.md`. Server components only (it uses
 * `fs`); on static routes it runs at build time.
 */
export async function readRoadmap(): Promise<Roadmap> {
  return parseRoadmap(await readFile(ROADMAP_PATH, 'utf8'));
}
