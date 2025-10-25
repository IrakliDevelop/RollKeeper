import { PlayerCharacter } from '@/store/playerStore';
import { PlayerCharacter as EnhancedPlayerCharacter } from '@/store/enhancedPlayerStore';

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errors: Array<{
    characterName: string;
    error: string;
  }>;
}

export interface MigrationOptions {
  overwriteExisting?: boolean;
  dryRun?: boolean;
  batchSize?: number;
}

/**
 * Migrate characters from old PlayerCharacter format to enhanced format
 */
export function migrateCharacterFormat(oldCharacter: PlayerCharacter): EnhancedPlayerCharacter {
  return {
    ...oldCharacter,
    // Add new fields with defaults
    syncStatus: 'local' as const,
    lastSynced: undefined,
    isPublic: false,
    backendId: undefined,
    campaignId: undefined,
  };
}

/**
 * Migrate localStorage characters to backend
 */
export async function migrateCharactersToBackend(
  characters: PlayerCharacter[],
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const {
    overwriteExisting = false,
    dryRun = false,
    batchSize = 5,
  } = options;

  const result: MigrationResult = {
    success: false,
    migratedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  // Check authentication
  const authData = localStorage.getItem('rollkeeper-auth');
  if (!authData) {
    result.errors.push({
      characterName: 'Authentication',
      error: 'User not authenticated',
    });
    return result;
  }

  const { accessToken } = JSON.parse(authData);
  if (!accessToken) {
    result.errors.push({
      characterName: 'Authentication',
      error: 'No access token found',
    });
    return result;
  }

  // Helper function for API calls
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  };

  // Get existing backend characters to avoid duplicates
  let existingCharacters: Array<{ id: string; name: string; character_data: unknown }> = [];
  try {
    const response = await apiCall('/api/characters');
    existingCharacters = response.characters || [];
  } catch (error) {
    result.errors.push({
      characterName: 'Backend Check',
      error: `Failed to fetch existing characters: ${error}`,
    });
    return result;
  }

  // Process characters in batches
  const batches = [];
  for (let i = 0; i < characters.length; i += batchSize) {
    batches.push(characters.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const batchPromises = batch.map(async (character) => {
      try {
        // Check if character already exists in backend
        const existingCharacter = existingCharacters.find(
          bc => bc.name === character.name && 
               JSON.stringify(bc.character_data) === JSON.stringify(character.characterData)
        );

        if (existingCharacter && !overwriteExisting) {
          result.skippedCount++;
          return;
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would migrate character: ${character.name}`);
          result.migratedCount++;
          return;
        }

        // Create character in backend
        const response = await apiCall('/api/characters', {
          method: 'POST',
          body: JSON.stringify({
            name: character.name,
            character_data: character.characterData,
            campaign_id: null,
            is_public: false,
          }),
        });

        result.migratedCount++;
        console.log(`Successfully migrated character: ${character.name}`);
        
        return response.character;
      } catch (error) {
        result.errors.push({
          characterName: character.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Wait for batch to complete
    await Promise.allSettled(batchPromises);
    
    // Small delay between batches to avoid overwhelming the server
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  result.success = result.errors.length === 0 || result.migratedCount > 0;
  return result;
}

/**
 * Get migration preview - shows what would be migrated
 */
export function getMigrationPreview(characters: PlayerCharacter[]): {
  total: number;
  localOnly: number;
  needsUpdate: number;
  duplicates: string[];
} {
  const preview = {
    total: characters.length,
    localOnly: characters.filter(c => !('backendId' in c) || !(c as unknown as { backendId?: string }).backendId).length,
    needsUpdate: 0, // Would need to check against backend
    duplicates: [] as string[],
  };

  // Find potential duplicates by name
  const nameCount: Record<string, number> = {};
  characters.forEach(c => {
    nameCount[c.name] = (nameCount[c.name] || 0) + 1;
    if (nameCount[c.name] > 1) {
      preview.duplicates.push(c.name);
    }
  });

  return preview;
}

/**
 * Clean up localStorage after successful migration
 */
export function cleanupAfterMigration(charactersToClean: string[]): void {
  try {
    const storageKey = 'rollkeeper-player-data';
    const stored = localStorage.getItem(storageKey);
    
    if (!stored) return;

    const data = JSON.parse(stored);
    if (data.state && data.state.characters) {
      // Remove migrated characters
      data.state.characters = data.state.characters.filter(
        (c: PlayerCharacter) => !charactersToClean.includes(c.id)
      );
      
      localStorage.setItem(storageKey, JSON.stringify(data));
    }
  } catch (error) {
    console.error('Error cleaning up localStorage after migration:', error);
  }
}

/**
 * Backup localStorage data before migration
 */
export function backupLocalStorageData(): string {
  try {
    const backup = {
      timestamp: new Date().toISOString(),
      playerData: localStorage.getItem('rollkeeper-player-data'),
      authData: localStorage.getItem('rollkeeper-auth'),
    };
    
    return JSON.stringify(backup, null, 2);
  } catch (error) {
    console.error('Error creating backup:', error);
    return '';
  }
}

/**
 * Restore localStorage data from backup
 */
export function restoreFromBackup(backupData: string): boolean {
  try {
    const backup = JSON.parse(backupData);
    
    if (backup.playerData) {
      localStorage.setItem('rollkeeper-player-data', backup.playerData);
    }
    
    if (backup.authData) {
      localStorage.setItem('rollkeeper-auth', backup.authData);
    }
    
    return true;
  } catch (error) {
    console.error('Error restoring from backup:', error);
    return false;
  }
}

/**
 * Validate migration data integrity
 */
export function validateMigrationData(characters: PlayerCharacter[]): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  characters.forEach((character, index) => {
    if (!character.id) {
      issues.push(`Character at index ${index} missing ID`);
    }
    
    if (!character.name || character.name.trim().length === 0) {
      issues.push(`Character at index ${index} missing or empty name`);
    }
    
    if (!character.characterData) {
      issues.push(`Character "${character.name}" missing character data`);
    }
    
    if (!character.createdAt) {
      issues.push(`Character "${character.name}" missing created date`);
    }
  });
  
  return {
    isValid: issues.length === 0,
    issues,
  };
}
