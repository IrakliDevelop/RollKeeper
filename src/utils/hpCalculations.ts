import { calculateModifier } from './calculations';
import { CLASS_HIT_DICE } from './constants';
import { HitPoints, DeathSavingThrows, ClassInfo } from '@/types/character';

/**
 * Calculate maximum HP for a character using D&D 5e rules
 * Level 1: Max hit die + CON modifier
 * Subsequent levels: Average of hit die (rounded up) + CON modifier per level
 */
export function calculateMaxHP(
  classInfo: ClassInfo,
  level: number,
  constitutionScore: number,
  manualOverride?: number
): number {
  if (manualOverride !== undefined) {
    return manualOverride;
  }

  const conModifier = calculateModifier(constitutionScore);
  const hitDie = classInfo.hitDie;

  // Level 1: Full hit die + CON modifier
  let maxHP = hitDie + conModifier;

  // Subsequent levels: Average hit die (rounded up) + CON modifier
  if (level > 1) {
    const averageHitDieRoll = Math.floor(hitDie / 2) + 1; // (hitDie + 1) / 2 rounded up
    maxHP += (level - 1) * (averageHitDieRoll + conModifier);
  }

  // Minimum 1 HP per level
  return Math.max(maxHP, level);
}

/**
 * Get hit die for a class name, with fallback for custom classes
 */
export function getClassHitDie(
  className: string,
  customHitDie?: number
): number {
  if (customHitDie) {
    return customHitDie;
  }

  return CLASS_HIT_DICE[className] || 8; // Default to d8 for unknown classes
}

/**
 * Apply damage following D&D 5e rules:
 * 1. Damage hits temporary HP first
 * 2. Excess damage carries over to current HP
 * 3. If current HP reaches 0, trigger death saves
 * 4. If excess damage after reaching 0 HP >= max HP, instant death (massive damage)
 */
export function applyDamage(hitPoints: HitPoints, damage: number): HitPoints {
  if (damage <= 0) return hitPoints;

  let remainingDamage = damage;
  let newTempHP = hitPoints.temporary;
  let newCurrentHP = hitPoints.current;
  let deathSaves = hitPoints.deathSaves;

  // First, damage temporary HP
  if (newTempHP > 0) {
    const tempDamage = Math.min(remainingDamage, newTempHP);
    newTempHP -= tempDamage;
    remainingDamage -= tempDamage;
  }

  // Then damage current HP
  if (remainingDamage > 0) {
    // Calculate how much damage it takes to reach 0 HP
    const damageToZero = Math.min(remainingDamage, newCurrentHP);
    newCurrentHP -= damageToZero;

    // If we hit 0 HP or below
    if (newCurrentHP <= 0) {
      newCurrentHP = 0;

      // Calculate excess damage after reaching 0 HP (massive damage calculation)
      const excessDamage = remainingDamage - damageToZero;

      // Check for massive damage (excess damage >= max HP)
      if (excessDamage >= hitPoints.max) {
        // Instant death from massive damage
        deathSaves = {
          successes: 0,
          failures: 3,
          isStabilized: false,
        };
      } else if (!deathSaves) {
        // Start death saving throws (unconscious but not dead)
        deathSaves = {
          successes: 0,
          failures: 0,
          isStabilized: false,
        };
      }
    }
  }

  return {
    ...hitPoints,
    current: newCurrentHP,
    temporary: newTempHP,
    deathSaves,
  };
}

/**
 * Apply healing following D&D 5e rules:
 * 1. Healing only affects current HP, not temporary HP
 * 2. Cannot exceed maximum HP
 * 3. Any healing removes death save state
 */
export function applyHealing(hitPoints: HitPoints, healing: number): HitPoints {
  if (healing <= 0) return hitPoints;

  const newCurrentHP = Math.min(hitPoints.current + healing, hitPoints.max);
  let deathSaves = hitPoints.deathSaves;

  // Any healing while at 0 HP removes death save state
  if (hitPoints.current === 0 && healing > 0) {
    deathSaves = undefined;
  }

  return {
    ...hitPoints,
    current: newCurrentHP,
    deathSaves,
  };
}

/**
 * Add temporary HP following D&D 5e rules:
 * 1. Temporary HP doesn't stack - take the higher value
 * 2. Temporary HP doesn't affect current or max HP
 */
export function addTemporaryHP(
  hitPoints: HitPoints,
  tempHP: number
): HitPoints {
  if (tempHP <= 0) return hitPoints;

  return {
    ...hitPoints,
    temporary: Math.max(hitPoints.temporary, tempHP),
  };
}

/**
 * Make a death saving throw
 * @param isSuccess - whether the death save was successful (d20 >= 10)
 * @param isCritical - whether it was a critical success (natural 20)
 */
export function makeDeathSave(
  hitPoints: HitPoints,
  isSuccess: boolean,
  isCritical: boolean = false
): HitPoints {
  if (!hitPoints.deathSaves) {
    return hitPoints;
  }

  let newDeathSaves: DeathSavingThrows | undefined = {
    ...hitPoints.deathSaves,
  };
  let newCurrentHP = hitPoints.current;

  if (isSuccess) {
    if (isCritical) {
      // Natural 20: regain 1 HP and become conscious
      newCurrentHP = 1;
      newDeathSaves = undefined; // Remove death saves
    } else {
      // Regular success
      newDeathSaves.successes = Math.min(newDeathSaves.successes + 1, 3);

      // 3 successes = stabilized
      if (newDeathSaves.successes >= 3) {
        newDeathSaves.isStabilized = true;
      }
    }
  } else {
    // Failure
    newDeathSaves.failures = Math.min(newDeathSaves.failures + 1, 3);
  }

  return {
    ...hitPoints,
    current: newCurrentHP,
    deathSaves: newDeathSaves,
  };
}

/**
 * Reset death saving throws (used when character is healed or stabilized)
 */
export function resetDeathSaves(hitPoints: HitPoints): HitPoints {
  return {
    ...hitPoints,
    deathSaves: undefined,
  };
}

/**
 * Check if character is dying (unconscious and making death saves)
 */
export function isDying(hitPoints: HitPoints): boolean {
  return (
    hitPoints.current === 0 &&
    !!hitPoints.deathSaves &&
    !hitPoints.deathSaves.isStabilized
  );
}

/**
 * Check if character is dead (3 failed death saves)
 */
export function isDead(hitPoints: HitPoints): boolean {
  return !!hitPoints.deathSaves && hitPoints.deathSaves.failures >= 3;
}

/**
 * Check if character is stabilized (0 HP but not dying)
 */
export function isStabilized(hitPoints: HitPoints): boolean {
  return (
    hitPoints.current === 0 &&
    !!hitPoints.deathSaves &&
    hitPoints.deathSaves.isStabilized
  );
}
