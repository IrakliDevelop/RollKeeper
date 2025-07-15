import { CharacterExport } from '@/types/character';

/**
 * Export character data as a JSON file download
 */
export const exportCharacterToFile = (exportData: CharacterExport): void => {
  const characterName = exportData.character.name || 'character';
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const filename = `${characterName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${timestamp}.json`;
  
  const dataStr = JSON.stringify(exportData, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', filename);
  linkElement.style.display = 'none';
  
  document.body.appendChild(linkElement);
  linkElement.click();
  document.body.removeChild(linkElement);
};

/**
 * Import character data from a file
 */
export const importCharacterFromFile = (): Promise<CharacterExport> => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      
      if (!file.name.toLowerCase().endsWith('.json')) {
        reject(new Error('Please select a valid JSON file'));
        return;
      }
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Basic validation
        if (!data.character || typeof data.character !== 'object') {
          reject(new Error('Invalid character file format'));
          return;
        }
        
        // Check for required character properties
        const requiredProps = ['name', 'abilities', 'skills', 'savingThrows'];
        for (const prop of requiredProps) {
          if (!(prop in data.character)) {
            reject(new Error(`Missing required character property: ${prop}`));
            return;
          }
        }
        
        resolve(data as CharacterExport);
      } catch (error) {
        if (error instanceof SyntaxError) {
          reject(new Error('Invalid JSON file format'));
        } else {
          reject(error);
        }
      } finally {
        document.body.removeChild(input);
      }
    };
    
    input.oncancel = () => {
      document.body.removeChild(input);
      reject(new Error('File selection cancelled'));
    };
    
    document.body.appendChild(input);
    input.click();
  });
};

/**
 * Copy character data to clipboard as JSON
 */
export const copyCharacterToClipboard = async (exportData: CharacterExport): Promise<void> => {
  const dataStr = JSON.stringify(exportData, null, 2);
  
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(dataStr);
  } else {
    // Fallback for older browsers or non-secure contexts
    const textArea = document.createElement('textarea');
    textArea.value = dataStr;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    return new Promise((resolve, reject) => {
      if (document.execCommand('copy')) {
        resolve();
      } else {
        reject(new Error('Failed to copy to clipboard'));
      }
      document.body.removeChild(textArea);
    });
  }
};

/**
 * Paste character data from clipboard
 */
export const pasteCharacterFromClipboard = async (): Promise<CharacterExport> => {
  let text: string;
  
  if (navigator.clipboard && window.isSecureContext) {
    text = await navigator.clipboard.readText();
  } else {
    throw new Error('Clipboard access not available in this browser');
  }
  
  if (!text.trim()) {
    throw new Error('Clipboard is empty');
  }
  
  try {
    const data = JSON.parse(text);
    
    // Basic validation
    if (!data.character || typeof data.character !== 'object') {
      throw new Error('Invalid character data in clipboard');
    }
    
    return data as CharacterExport;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON format in clipboard');
    }
    throw error;
  }
};

/**
 * Validate character export data structure
 */
export const validateCharacterExport = (data: unknown): boolean => {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  const dataObj = data as Record<string, unknown>;
  
  if (!dataObj.character || typeof dataObj.character !== 'object') {
    return false;
  }
  
  const character = dataObj.character as Record<string, unknown>;
  
  // Check required properties exist
  const requiredProps = ['name', 'abilities', 'skills', 'savingThrows', 'hitPoints'];
  for (const prop of requiredProps) {
    if (!(prop in character)) {
      return false;
    }
  }
  
  // Validate abilities structure
  if (!character.abilities || typeof character.abilities !== 'object') {
    return false;
  }
  
  const abilities = character.abilities as Record<string, unknown>;
  const requiredAbilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  for (const ability of requiredAbilities) {
    if (typeof abilities[ability] !== 'number') {
      return false;
    }
  }
  
  // Validate skills structure
  if (!character.skills || typeof character.skills !== 'object') {
    return false;
  }
  
  // Validate saving throws structure
  if (!character.savingThrows || typeof character.savingThrows !== 'object') {
    return false;
  }
  
  // Validate hit points structure
  if (!character.hitPoints || typeof character.hitPoints !== 'object') {
    return false;
  }
  
  const hitPoints = character.hitPoints as Record<string, unknown>;
  const requiredHPProps = ['current', 'max', 'temporary'];
  for (const prop of requiredHPProps) {
    if (typeof hitPoints[prop] !== 'number') {
      return false;
    }
  }
  
  return true;
}; 