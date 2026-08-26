import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const ESLINT_WARNING_BASELINE = 69;
const PRETTIER_DEVIATION_BASELINE = 273;
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

export function assessLintBaseline({ errors, warnings }, allowedWarnings) {
  if (errors > 0) {
    return {
      ok: false,
      message: `ESLint errors: ${errors}; warnings: ${warnings}/${allowedWarnings} allowed`,
    };
  }

  return {
    ok: warnings <= allowedWarnings,
    message: `ESLint warnings: ${warnings}/${allowedWarnings} allowed`,
  };
}

export function assessFormatBaseline(deviations, allowedDeviations) {
  return {
    ok: deviations <= allowedDeviations,
    message: `Prettier deviations: ${deviations}/${allowedDeviations} allowed`,
  };
}

async function checkLint() {
  const eslint = new ESLint({ cwd: repositoryRoot });
  const results = await eslint.lintFiles(['.']);
  const totals = results.reduce(
    (sum, result) => ({
      errors: sum.errors + result.errorCount,
      warnings: sum.warnings + result.warningCount,
    }),
    { errors: 0, warnings: 0 }
  );
  const assessment = assessLintBaseline(totals, ESLINT_WARNING_BASELINE);

  console.log(assessment.message);
  if (!assessment.ok) {
    const formatter = await eslint.loadFormatter('stylish');
    console.error(formatter.format(results));
    process.exitCode = 1;
  }
}

function checkFormat() {
  const prettierCli = path.join(
    repositoryRoot,
    'node_modules',
    'prettier',
    'bin',
    'prettier.cjs'
  );
  const result = spawnSync(
    process.execPath,
    [prettierCli, '--list-different', '.'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }
  );

  if (result.error || (result.status !== 0 && result.status !== 1)) {
    throw result.error ?? new Error(result.stderr || 'Prettier failed to run');
  }

  const deviations = result.stdout
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean).length;
  const assessment = assessFormatBaseline(
    deviations,
    PRETTIER_DEVIATION_BASELINE
  );

  console.log(assessment.message);
  if (!assessment.ok) {
    console.error(result.stdout.trim());
    process.exitCode = 1;
  }
}

const command = process.argv[2];

if (command === 'lint') {
  await checkLint();
} else if (command === 'format') {
  checkFormat();
} else if (command !== undefined) {
  throw new Error(`Unknown quality ratchet command: ${command}`);
}
