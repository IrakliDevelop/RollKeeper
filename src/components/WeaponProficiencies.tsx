'use client';

import React, { useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { Shield, Plus, X } from 'lucide-react';
import { Checkbox, Input, Button } from '@/components/ui/forms';

export const WeaponProficiencies: React.FC = () => {
  const { character, updateCharacter } = useCharacterStore();
  const [specificWeaponInput, setSpecificWeaponInput] = useState('');

  const toggleSimpleWeapons = () => {
    updateCharacter({
      weaponProficiencies: {
        ...character.weaponProficiencies,
        simpleWeapons: !character.weaponProficiencies.simpleWeapons,
      },
    });
  };

  const toggleMartialWeapons = () => {
    updateCharacter({
      weaponProficiencies: {
        ...character.weaponProficiencies,
        martialWeapons: !character.weaponProficiencies.martialWeapons,
      },
    });
  };

  const addSpecificWeapon = () => {
    if (
      specificWeaponInput.trim() &&
      !character.weaponProficiencies.specificWeapons.includes(
        specificWeaponInput.trim().toLowerCase()
      )
    ) {
      updateCharacter({
        weaponProficiencies: {
          ...character.weaponProficiencies,
          specificWeapons: [
            ...character.weaponProficiencies.specificWeapons,
            specificWeaponInput.trim().toLowerCase(),
          ],
        },
      });
      setSpecificWeaponInput('');
    }
  };

  const removeSpecificWeapon = (weaponName: string) => {
    updateCharacter({
      weaponProficiencies: {
        ...character.weaponProficiencies,
        specificWeapons: character.weaponProficiencies.specificWeapons.filter(
          w => w !== weaponName
        ),
      },
    });
  };

  return (
    <div className="border-divider bg-surface-raised rounded-lg border p-4 shadow-lg">
      <h2 className="border-divider text-heading mb-3 flex items-center gap-2 border-b pb-2 text-lg font-bold">
        <Shield className="text-accent-blue-text-muted" size={20} />
        Weapon Proficiencies
      </h2>

      <div className="space-y-3">
        {/* Category Proficiencies */}
        <div className="space-y-2">
          <Checkbox
            checked={character.weaponProficiencies.simpleWeapons}
            onCheckedChange={toggleSimpleWeapons}
            label="Simple Weapons"
            size="sm"
            variant="primary"
            className="hover:bg-surface-hover rounded-lg p-2 transition-colors"
          />

          <Checkbox
            checked={character.weaponProficiencies.martialWeapons}
            onCheckedChange={toggleMartialWeapons}
            label="Martial Weapons"
            size="sm"
            variant="primary"
            className="hover:bg-surface-hover rounded-lg p-2 transition-colors"
          />
        </div>

        {/* Specific Weapons */}
        <div className="mt-4">
          <h4 className="text-body mb-2 text-sm font-semibold">
            Specific Weapons
          </h4>

          <div className="mb-2 flex gap-2">
            <Input
              type="text"
              value={specificWeaponInput}
              onChange={e => setSpecificWeaponInput(e.target.value)}
              placeholder="Rapier, Longbow, etc."
              size="sm"
              className="flex-1"
              onKeyPress={e =>
                e.key === 'Enter' && (e.preventDefault(), addSpecificWeapon())
              }
            />
            <Button
              onClick={addSpecificWeapon}
              variant="primary"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus size={14} />
            </Button>
          </div>

          <div className="flex flex-wrap gap-1">
            {character.weaponProficiencies.specificWeapons.map(
              (weapon, index) => (
                <span
                  key={index}
                  className="bg-accent-green-bg text-accent-green-text inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
                >
                  {weapon}
                  <Button
                    onClick={() => removeSpecificWeapon(weapon)}
                    variant="ghost"
                    size="xs"
                    className="text-accent-green-text hover:text-accent-green-text ml-1 h-auto p-0 hover:bg-transparent"
                  >
                    <X size={12} />
                  </Button>
                </span>
              )
            )}
          </div>

          {character.weaponProficiencies.specificWeapons.length === 0 && (
            <p className="text-muted mt-1 text-xs">
              No specific weapon proficiencies
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
