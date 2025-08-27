'use client';

import React from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { CurrencyManager as SharedCurrencyManager } from '@/components/shared/character';

export default function CurrencyManager() {
  const { 
    character, 
    addCurrency,
    subtractCurrency
  } = useCharacterStore();

  // Use the shared CurrencyManager component with full functionality
  return (
    <SharedCurrencyManager
      currency={character.currency}
      onAddCurrency={addCurrency}
      onSubtractCurrency={subtractCurrency}
      readonly={false}
      compact={false}
      hideControls={false}
      hideConversionInfo={false}
      showOnlyTotal={false}
      hideIndividualCurrencies={false}
    />
  );
} 