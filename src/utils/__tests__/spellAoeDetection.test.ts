import { describe, it, expect } from 'vitest';
import { detectSpellAoe, aoeEquals } from '@/utils/spellAoeDetection';

// Real spell prose (PHB / XPHB wordings) — these are the spec's fixture set.
const FIREBALL =
  'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw.';
const LIGHTNING_BOLT =
  'A stroke of lightning forming a line 100 feet long and 5 feet wide blasts out from you in a direction you choose.';
const BURNING_HANDS =
  'A thin sheet of flames shoots forth from your outstretched fingertips. Each creature in a 15-foot cone must make a Dexterity saving throw.';
const CONE_OF_COLD =
  'A blast of cold air erupts from your hands. Each creature in a 60-foot cone must make a Constitution saving throw.';
const THUNDERWAVE =
  'A wave of thunderous force sweeps out from you. Each creature in a 15-foot cube originating from you must make a Constitution saving throw.';
const WEB =
  'You conjure a mass of thick, sticky webbing at a point of your choice within range. The webs fill a 20-foot cube from that point for the duration.';
const MOONBEAM =
  'A silvery beam of pale light shines down in a 5-foot-radius, 40-foot-high cylinder centered on a point within range.';
const SPIRIT_GUARDIANS_2014 =
  'You call forth spirits to protect you. They flit around you to a distance of 15 feet for the duration.';
const SPIRIT_GUARDIANS_2024 =
  'Protective spirits flit around you in a 15-foot Emanation for the duration.';
const WALL_OF_FIRE =
  'You create a wall of fire on a solid surface within range. You can make the wall up to 60 feet long, 20 feet high, and 1 foot thick.';
const SLEEP_2014 =
  'Creatures within 20 feet of a point you choose within range are affected in ascending order of their current hit points.';
const DARKNESS =
  'Magical darkness spreads from a point you choose within range to fill a 15-foot-radius sphere for the duration.';
const MAGIC_MISSILE =
  'You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range.';
const CURE_WOUNDS =
  'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.';
const SHIELD =
  'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC.';

describe('detectSpellAoe', () => {
  it('detects radius spheres as circles (Fireball)', () => {
    expect(detectSpellAoe(FIREBALL, '150 feet')).toEqual({
      shape: 'circle',
      sizeFeet: 20,
    });
  });

  it('detects lines with explicit length and width (Lightning Bolt)', () => {
    expect(detectSpellAoe(LIGHTNING_BOLT, 'Self')).toEqual({
      shape: 'line',
      sizeFeet: 100,
      widthFeet: 5,
    });
  });

  it('detects cones (Burning Hands, Cone of Cold)', () => {
    expect(detectSpellAoe(BURNING_HANDS)).toEqual({
      shape: 'cone',
      sizeFeet: 15,
    });
    expect(detectSpellAoe(CONE_OF_COLD)).toEqual({
      shape: 'cone',
      sizeFeet: 60,
    });
  });

  it('detects cubes as squares (Thunderwave, Web)', () => {
    expect(detectSpellAoe(THUNDERWAVE)).toEqual({
      shape: 'square',
      sizeFeet: 15,
    });
    expect(detectSpellAoe(WEB)).toEqual({ shape: 'square', sizeFeet: 20 });
  });

  it('detects cylinders as circles by radius (Moonbeam)', () => {
    expect(detectSpellAoe(MOONBEAM)).toEqual({ shape: 'circle', sizeFeet: 5 });
  });

  it('detects self-emanations in both 2014 and 2024 wordings (Spirit Guardians)', () => {
    expect(detectSpellAoe(SPIRIT_GUARDIANS_2014)).toEqual({
      shape: 'circle',
      sizeFeet: 15,
    });
    expect(detectSpellAoe(SPIRIT_GUARDIANS_2024)).toEqual({
      shape: 'circle',
      sizeFeet: 15,
    });
  });

  it('detects walls as lines (Wall of Fire)', () => {
    expect(detectSpellAoe(WALL_OF_FIRE)).toEqual({
      shape: 'line',
      sizeFeet: 60,
      widthFeet: 5,
    });
  });

  it('detects point-bursts phrased as "within X feet of a point" (Sleep)', () => {
    expect(detectSpellAoe(SLEEP_2014)).toEqual({
      shape: 'circle',
      sizeFeet: 20,
    });
  });

  it('detects utility AoEs (Darkness)', () => {
    expect(detectSpellAoe(DARKNESS)).toEqual({ shape: 'circle', sizeFeet: 15 });
  });

  it('detects bare lines with default 5 ft width', () => {
    expect(detectSpellAoe('The spell creates a 30-foot line of acid.')).toEqual(
      {
        shape: 'line',
        sizeFeet: 30,
        widthFeet: 5,
      }
    );
  });

  it('halves diameters', () => {
    expect(detectSpellAoe('fills a 40-foot-diameter sphere')).toEqual({
      shape: 'circle',
      sizeFeet: 20,
    });
  });

  it('detects "each creature within X feet of you"', () => {
    expect(
      detectSpellAoe(
        'Each creature within 10 feet of you takes thunder damage.'
      )
    ).toEqual({ shape: 'circle', sizeFeet: 10 });
  });

  it('returns null for non-AoE spells', () => {
    expect(detectSpellAoe(MAGIC_MISSILE, '120 feet')).toBeNull();
    expect(detectSpellAoe(CURE_WOUNDS, 'Touch')).toBeNull();
    expect(detectSpellAoe(SHIELD, 'Self')).toBeNull();
  });

  it('strips TipTap HTML before matching', () => {
    const html =
      '<p>Each creature in a <strong>20-foot-radius</strong> sphere centered on that point must make a <em>Dexterity</em> saving throw.</p>';
    expect(detectSpellAoe(html)).toEqual({ shape: 'circle', sizeFeet: 20 });
  });

  it('strips 5eTools {@...} tags before matching', () => {
    const tagged =
      'A creature takes {@damage 8d6} fire damage. Each creature in a 20-foot-radius sphere must save.';
    expect(detectSpellAoe(tagged)).toEqual({ shape: 'circle', sizeFeet: 20 });
  });

  it('tolerates non-string input defensively', () => {
    expect(detectSpellAoe(undefined)).toBeNull();
    expect(detectSpellAoe(null, 42)).toBeNull();
    expect(detectSpellAoe(123 as unknown)).toBeNull();
  });

  it('prefers line over circle when both appear (order of specificity)', () => {
    const both =
      'forming a line 100 feet long and 5 feet wide. Creatures in a 10-foot-radius glow.';
    expect(detectSpellAoe(both)).toEqual({
      shape: 'line',
      sizeFeet: 100,
      widthFeet: 5,
    });
  });
});

describe('aoeEquals', () => {
  it('treats null and undefined as equal (both "no AoE")', () => {
    expect(aoeEquals(null, null)).toBe(true);
    expect(aoeEquals(null, undefined)).toBe(true);
    expect(aoeEquals(undefined, undefined)).toBe(true);
  });

  it('null differs from a value', () => {
    expect(aoeEquals(null, { shape: 'circle', sizeFeet: 20 })).toBe(false);
    expect(aoeEquals({ shape: 'circle', sizeFeet: 20 }, null)).toBe(false);
  });

  it('compares shape and size', () => {
    expect(
      aoeEquals(
        { shape: 'circle', sizeFeet: 20 },
        { shape: 'circle', sizeFeet: 20 }
      )
    ).toBe(true);
    expect(
      aoeEquals(
        { shape: 'circle', sizeFeet: 20 },
        { shape: 'cone', sizeFeet: 20 }
      )
    ).toBe(false);
    expect(
      aoeEquals(
        { shape: 'circle', sizeFeet: 20 },
        { shape: 'circle', sizeFeet: 30 }
      )
    ).toBe(false);
  });

  it('treats missing widthFeet as the default 5', () => {
    expect(
      aoeEquals(
        { shape: 'line', sizeFeet: 30 },
        { shape: 'line', sizeFeet: 30, widthFeet: 5 }
      )
    ).toBe(true);
    expect(
      aoeEquals(
        { shape: 'line', sizeFeet: 30, widthFeet: 10 },
        { shape: 'line', sizeFeet: 30 }
      )
    ).toBe(false);
  });
});
