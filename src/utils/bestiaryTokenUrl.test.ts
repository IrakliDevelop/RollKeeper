import { describe, expect, test } from 'vitest';

import {
  bestiaryTokenUrl,
  fiveEToolsTokenUrl,
  isValidTokenSource,
  tokenS3Key,
} from './bestiaryTokenUrl';

describe('bestiaryTokenUrl', () => {
  test('builds root-relative route URL with encoded name', () => {
    expect(bestiaryTokenUrl('XMM', 'Zombie')).toBe(
      '/api/bestiary/token/XMM/Zombie'
    );
    expect(bestiaryTokenUrl('FTD', 'Adult Crystal Dragon')).toBe(
      '/api/bestiary/token/FTD/Adult%20Crystal%20Dragon'
    );
  });

  test('encodes apostrophes-adjacent and special characters safely', () => {
    // encodeURIComponent leaves ' alone but escapes # ? / &
    expect(bestiaryTokenUrl('MM', "Ezmerelda d'Avenir")).toBe(
      "/api/bestiary/token/MM/Ezmerelda%20d'Avenir"
    );
    expect(bestiaryTokenUrl('MM', 'A/B?C')).toBe(
      '/api/bestiary/token/MM/A%2FB%3FC'
    );
  });
});

describe('fiveEToolsTokenUrl', () => {
  test('matches the 5e.tools pattern', () => {
    expect(fiveEToolsTokenUrl('XMM', 'Zombie')).toBe(
      'https://5e.tools/img/bestiary/tokens/XMM/Zombie.webp'
    );
    expect(fiveEToolsTokenUrl('RHW', 'Strahd von Zarovich')).toBe(
      'https://5e.tools/img/bestiary/tokens/RHW/Strahd%20von%20Zarovich.webp'
    );
  });
});

describe('tokenS3Key', () => {
  test('mirrors the 5etools layout, unencoded (S3 keys allow spaces)', () => {
    expect(tokenS3Key('XMM', 'Zombie')).toBe('bestiary-tokens/XMM/Zombie.webp');
    expect(tokenS3Key('FTD', 'Adult Crystal Dragon')).toBe(
      'bestiary-tokens/FTD/Adult Crystal Dragon.webp'
    );
  });
});

describe('isValidTokenSource', () => {
  test('accepts alphanumeric and hyphen source codes', () => {
    expect(isValidTokenSource('XMM')).toBe(true);
    expect(isValidTokenSource('AitFR-DN')).toBe(true);
  });

  test('rejects empty, slashes, dots, and other traversal characters', () => {
    expect(isValidTokenSource('')).toBe(false);
    expect(isValidTokenSource('XMM/..')).toBe(false);
    expect(isValidTokenSource('..')).toBe(false);
    expect(isValidTokenSource('a b')).toBe(false);
  });
});
