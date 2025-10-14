import { generateCharacterId, isValidUUID } from './uuid';

export interface LegacyCharacter {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface MigrationReport {
  totalCharacters: number;
  migratedCharacters: number;
  skippedCharacters: number;
  errors: string[];
}

/**
 * Migrate character IDs from legacy format to UUID format
 */
export function migrateCharacterIdsToUUID(): MigrationReport {
  const report: MigrationReport = {
    totalCharacters: 0,
    migratedCharacters: 0,
    skippedCharacters: 0,
    errors: [],
  };

  try {
    // Get player store data
    const playerStoreKey = 'rollkeeper-player-data';
    const storedData = localStorage.getItem(playerStoreKey);
    
    if (!storedData) {
      console.log('No player data found in localStorage');
      return report;
    }

    const data = JSON.parse(storedData);
    if (!data.state || !data.state.characters) {
      console.log('No characters found in player store');
      return report;
    }

    const characters = data.state.characters as LegacyCharacter[];
    report.totalCharacters = characters.length;

    // Create ID mapping for references
    const idMapping: Record<string, string> = {};

    // First pass: create new UUIDs for characters that need them
    characters.forEach((character, index) => {
      try {
        if (!isValidUUID(character.id)) {
          const newId = generateCharacterId();
          idMapping[character.id] = newId;
          console.log(`Mapping character "${character.name}" from ${character.id} to ${newId}`);
        } else {
          report.skippedCharacters++;
        }
      } catch (error) {
        report.errors.push(`Error processing character at index ${index}: ${error}`);
      }
    });

    // Second pass: update character IDs and any references
    characters.forEach((character, index) => {
      try {
        const oldId = character.id;
        
        if (idMapping[oldId]) {
          // Update character ID
          character.id = idMapping[oldId];
          
          // Update character data ID if it exists
          if (character.characterData && character.characterData.id) {
            character.characterData.id = idMapping[oldId];
          }
          
          report.migratedCharacters++;
          console.log(`Migrated character "${character.name}" to UUID format`);
        }
      } catch (error) {
        report.errors.push(`Error migrating character at index ${index}: ${error}`);
      }
    });

    // Update active character ID if needed
    if (data.state.activeCharacterId && idMapping[data.state.activeCharacterId]) {
      data.state.activeCharacterId = idMapping[data.state.activeCharacterId];
    }

    // Update last selected character ID if needed
    if (data.state.lastSelectedCharacterId && idMapping[data.state.lastSelectedCharacterId]) {
      data.state.lastSelectedCharacterId = idMapping[data.state.lastSelectedCharacterId];
    }

    // Save updated data back to localStorage
    localStorage.setItem(playerStoreKey, JSON.stringify(data));
    
    console.log('Character ID migration completed:', report);
    return report;

  } catch (error) {
    report.errors.push(`Migration failed: ${error}`);
    console.error('Character ID migration error:', error);
    return report;
  }
}

/**
 * Check if migration is needed
 */
export function needsCharacterIdMigration(): boolean {
  try {
    const playerStoreKey = 'rollkeeper-player-data';
    const storedData = localStorage.getItem(playerStoreKey);
    
    if (!storedData) return false;

    const data = JSON.parse(storedData);
    if (!data.state || !data.state.characters) return false;

    const characters = data.state.characters as LegacyCharacter[];
    return characters.some(character => !isValidUUID(character.id));
  } catch (error) {
    console.error('Error checking migration need:', error);
    return false;
  }
}

/**
 * Create a backup before migration
 */
export function createBackupBeforeMigration(): string {
  try {
    const playerStoreKey = 'rollkeeper-player-data';
    const storedData = localStorage.getItem(playerStoreKey);
    
    if (!storedData) return '';

    const backup = {
      timestamp: new Date().toISOString(),
      data: storedData,
      type: 'character-id-migration-backup',
    };

    return JSON.stringify(backup, null, 2);
  } catch (error) {
    console.error('Error creating backup:', error);
    return '';
  }
}

/**
 * Restore from backup
 */
export function restoreFromBackup(backupData: string): boolean {
  try {
    const backup = JSON.parse(backupData);
    
    if (backup.type !== 'character-id-migration-backup') {
      throw new Error('Invalid backup type');
    }

    const playerStoreKey = 'rollkeeper-player-data';
    localStorage.setItem(playerStoreKey, backup.data);
    
    console.log('Restored from backup successfully');
    return true;
  } catch (error) {
    console.error('Error restoring from backup:', error);
    return false;
  }
}
