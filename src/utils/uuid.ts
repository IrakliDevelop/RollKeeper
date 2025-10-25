/**
 * Generate a UUID v4 (random UUID)
 * This is a simple implementation that doesn't require external dependencies
 */
export function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers/Node.js)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validate if a string is a valid UUID
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Generate a character ID (UUID format)
 */
export function generateCharacterId(): string {
  return generateUUID();
}

/**
 * Generate a campaign ID (UUID format)  
 */
export function generateCampaignId(): string {
  return generateUUID();
}
