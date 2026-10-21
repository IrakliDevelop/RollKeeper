import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { repositoryRoot } from './lib/design-source.mjs';

const read = file => readFile(path.join(repositoryRoot, file), 'utf8');

test('the Codex copy skill mirrors the Claude copy skill exactly', async () => {
  assert.equal(
    await read('.agents/skills/rollkeeper-copy/SKILL.md'),
    await read('.claude/skills/rollkeeper-copy/SKILL.md')
  );
});

test('the copy reviewer agent uses the skill and the extractor', async () => {
  const agent = await read('.claude/agents/rollkeeper-copy-reviewer.md');
  assert.match(agent, /^---\nname: rollkeeper-copy-reviewer\n/);
  assert.match(agent, /\.claude\/skills\/rollkeeper-copy\/SKILL\.md/);
  assert.match(agent, /npm run copy:changed/);
});

test('the Codex design skill mirrors the Claude design skill exactly', async () => {
  assert.equal(
    await read('.agents/skills/rollkeeper-design/SKILL.md'),
    await read('.claude/skills/rollkeeper-design/SKILL.md')
  );
});

test('the design skill and the design system doc point at each other', async () => {
  const skill = await read('.claude/skills/rollkeeper-design/SKILL.md');
  assert.match(skill, /^---\nname: rollkeeper-design\ndescription: Use when /);
  assert.match(skill, /docs\/DESIGN_SYSTEM\.md/);
  assert.match(skill, /rollkeeper-copy/);
  assert.match(
    await read('docs/DESIGN_SYSTEM.md'),
    /\.claude\/skills\/rollkeeper-design\/SKILL\.md/
  );
});

test('AGENTS.md points Claude Code and Codex at the design skill', async () => {
  const agents = await read('AGENTS.md');
  assert.match(agents, /\.claude\/skills\/rollkeeper-design\/SKILL\.md/);
  assert.match(agents, /\.agents\/skills\/rollkeeper-design\/SKILL\.md/);
});
