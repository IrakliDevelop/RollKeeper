#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const SEED_VERSION = 1;
const SENTINEL = 'rollkeeper-manual-browser-v1';

function persisted(state, version) {
  return JSON.stringify({ state, version });
}

export function buildFakeSeedBundle() {
  const localStorageEntries = {
    'rollkeeper-dm-data': persisted(
      {
        dmId: 'dm-manual-browser',
        campaigns: [
          {
            code: 'MANUAL',
            name: 'Synthetic Acceptance Campaign',
            createdAt: '2000-01-01T00:00:00.000Z',
          },
        ],
      },
      1
    ),
    'rollkeeper-encounter-data': persisted(
      {
        encounters: [],
        activeEncounterId: null,
        encounterTombstones: {},
        acceptanceSentinel: SENTINEL,
      },
      2
    ),
    'rollkeeper-npc-data': persisted(
      { npcsByCampaign: {}, acceptanceSentinel: SENTINEL },
      4
    ),
    'rollkeeper-calendar-data': persisted(
      { calendars: [], acceptanceSentinel: SENTINEL },
      3
    ),
    'rollkeeper-location-data': persisted(
      { locations: {}, acceptanceSentinel: SENTINEL },
      0
    ),
    'rollkeeper-battlemap-data': persisted(
      { battleMaps: {}, acceptanceSentinel: SENTINEL },
      0
    ),
    'rollkeeper-combat-log': persisted(
      { encounters: {}, acceptanceSentinel: SENTINEL },
      1
    ),
    'rollkeeper-dm-magic-item-library': persisted(
      { itemsByCampaign: {}, acceptanceSentinel: SENTINEL },
      1
    ),
    'rollkeeper-manual-acceptance-sentinel': SENTINEL,
  };

  const entries = Object.entries(localStorageEntries).map(
    ([key, rawValue]) => ({
      key,
      rawValue,
      utf8Bytes: Buffer.byteLength(rawValue, 'utf8'),
      sha256: createHash('sha256').update(rawValue, 'utf8').digest('hex'),
    })
  );
  const manifestInput = entries
    .map(({ key, utf8Bytes, sha256 }) => `${key}\0${utf8Bytes}\0${sha256}`)
    .join('\n');

  return {
    format: 'rollkeeper-manual-browser-seed',
    seedVersion: SEED_VERSION,
    characterDraft: {
      name: 'Mira Vale — Synthetic Acceptance',
      creationRoute: '/player/characters/new',
    },
    localStorageEntries,
    manifest: {
      entryCount: entries.length,
      totalUtf8Bytes: entries.reduce((sum, entry) => sum + entry.utf8Bytes, 0),
      sha256: createHash('sha256').update(manifestInput, 'utf8').digest('hex'),
      entries: entries.map(({ key, utf8Bytes, sha256 }) => ({
        key,
        utf8Bytes,
        sha256,
      })),
    },
  };
}

function printBundle() {
  const bundle = buildFakeSeedBundle();
  const summaryOnly = process.argv.includes('--summary');
  process.stdout.write(
    `${JSON.stringify(
      summaryOnly
        ? {
            format: bundle.format,
            seedVersion: bundle.seedVersion,
            characterDraft: bundle.characterDraft,
            manifest: bundle.manifest,
          }
        : bundle,
      null,
      2
    )}\n`
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  printBundle();
}
