import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const generatedTypesPath = path.join(
  repositoryRoot,
  'src',
  'types',
  'database.generated.ts'
);
const result = spawnSync(
  'npx',
  ['supabase', 'gen', 'types', 'typescript', '--local', '--schema', 'public'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  }
);

if (result.status !== 0) {
  throw new Error(result.stderr || 'Supabase type generation failed');
}

const formattedResult = spawnSync(
  'npx',
  ['prettier', '--parser', 'typescript'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
    input: result.stdout,
    maxBuffer: 10 * 1024 * 1024,
  }
);

if (formattedResult.status !== 0) {
  throw new Error(formattedResult.stderr || 'Generated type formatting failed');
}

const committedTypes = fs.readFileSync(generatedTypesPath, 'utf8');
assert.equal(
  committedTypes,
  formattedResult.stdout,
  'database.generated.ts is stale; run npm run db:types against a reset local stack'
);

console.log('Generated database types match the reset local schema.');
