'use client';

import React, { useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { Shield, Plus, X } from 'lucide-react';

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
    <div className="rounded-lg border border-amber-200 bg-white p-4 shadow-lg">
      <h2 className="mb-3 flex items-center gap-2 border-b border-gray-200 pb-2 text-lg font-bold text-gray-800">
        <Shield className="text-blue-600" size={20} />
        Weapon Proficiencies
      </h2>

      <div className="space-y-3">
        {/* Category Proficiencies */}
        <div className="space-y-2">
          <label className="flex items-center rounded-lg p-2 text-sm transition-colors hover:bg-blue-50">
            <input
              type="checkbox"
              checked={character.weaponProficiencies.simpleWeapons}
              onChange={toggleSimpleWeapons}
              className="mr-3 h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-gray-800">Simple Weapons</span>
          </label>

          <label className="flex items-center rounded-lg p-2 text-sm transition-colors hover:bg-blue-50">
            <input
              type="checkbox"
              checked={character.weaponProficiencies.martialWeapons}
              onChange={toggleMartialWeapons}
              className="mr-3 h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-gray-800">Martial Weapons</span>
          </label>
        </div>

        {/* Specific Weapons */}
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-gray-700">
            Specific Weapons
          </h4>

          <div className="mb-2 flex gap-2">
            <input
              type="text"
              value={specificWeaponInput}
              onChange={e => setSpecificWeaponInput(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="Rapier, Longbow, etc."
              onKeyPress={e =>
                e.key === 'Enter' && (e.preventDefault(), addSpecificWeapon())
              }
            />
            <button
              onClick={addSpecificWeapon}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-white transition-colors hover:bg-blue-700"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {character.weaponProficiencies.specificWeapons.map(
              (weapon, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800"
                >
                  {weapon}
                  <button
                    onClick={() => removeSpecificWeapon(weapon)}
                    className="ml-1 text-green-600 hover:text-green-800"
                  >
                    <X size={12} />
                  </button>
                </span>
              )
            )}
          </div>

          {character.weaponProficiencies.specificWeapons.length === 0 && (
            <p className="mt-1 text-xs text-gray-500">
              No specific weapon proficiencies
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
