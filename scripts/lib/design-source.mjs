import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);

const SOURCE_FILE = /\.(ts|tsx)$/;
const EXCLUDED_FILE = /(\.test\.|\.stories\.|\/__tests__\/|\.d\.ts$)/;

export async function listSourceFiles(root = repositoryRoot) {
  const entries = await readdir(path.join(root, 'src'), { recursive: true });
  return entries
    .map(entry => path.posix.join('src', entry.split(path.sep).join('/')))
    .filter(file => SOURCE_FILE.test(file) && !EXCLUDED_FILE.test(file))
    .sort();
}

export async function readSourceFiles(root = repositoryRoot) {
  const files = await listSourceFiles(root);
  return Promise.all(
    files.map(async file => ({
      path: file,
      text: await readFile(path.join(root, file), 'utf8'),
    }))
  );
}

export function readGlobalsCss(root = repositoryRoot) {
  return readFile(path.join(root, 'src', 'app', 'globals.css'), 'utf8');
}
