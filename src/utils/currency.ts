// Currency conversion utility functions

export function formatCurrencyFromCopper(totalCopper: number): string {
  if (!totalCopper || totalCopper <= 0) return '0 cp';
  
  const gold = Math.floor(totalCopper / 100);
  const remainingAfterGold = totalCopper % 100;
  
  const silver = Math.floor(remainingAfterGold / 10);
  const copper = remainingAfterGold % 10;
  
  const parts = [];
  
  if (gold > 0) parts.push(`${gold} gp`);
  if (silver > 0) parts.push(`${silver} sp`);
  if (copper > 0) parts.push(`${copper} cp`);
  
  return parts.join(', ');
}

export function formatCurrencyFromCopperShort(totalCopper: number): string {
  if (!totalCopper || totalCopper <= 0) return '0cp';
  
  const gold = Math.floor(totalCopper / 100);
  const remainingAfterGold = totalCopper % 100;
  
  const silver = Math.floor(remainingAfterGold / 10);
  const copper = remainingAfterGold % 10;
  
  const parts = [];
  
  if (gold > 0) parts.push(`${gold}g`);
  if (silver > 0) parts.push(`${silver}s`);
  if (copper > 0) parts.push(`${copper}c`);
  
  return parts.join(' ');
} 