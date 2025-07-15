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
        simpleWeapons: !character.weaponProficiencies.simpleWeapons
      }
    });
  };

  const toggleMartialWeapons = () => {
    updateCharacter({
      weaponProficiencies: {
        ...character.weaponProficiencies,
        martialWeapons: !character.weaponProficiencies.martialWeapons
      }
    });
  };

  const addSpecificWeapon = () => {
    if (specificWeaponInput.trim() && !character.weaponProficiencies.specificWeapons.includes(specificWeaponInput.trim().toLowerCase())) {
      updateCharacter({
        weaponProficiencies: {
          ...character.weaponProficiencies,
          specificWeapons: [...character.weaponProficiencies.specificWeapons, specificWeaponInput.trim().toLowerCase()]
        }
      });
      setSpecificWeaponInput('');
    }
  };

  const removeSpecificWeapon = (weaponName: string) => {
    updateCharacter({
      weaponProficiencies: {
        ...character.weaponProficiencies,
        specificWeapons: character.weaponProficiencies.specificWeapons.filter(w => w !== weaponName)
      }
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-4">
      <h2 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2 flex items-center gap-2">
        <Shield className="text-blue-600" size={20} />
        Weapon Proficiencies
      </h2>
      
      <div className="space-y-3">
        {/* Category Proficiencies */}
        <div className="space-y-2">
          <label className="flex items-center text-sm hover:bg-blue-50 p-2 rounded-lg transition-colors">
            <input
              type="checkbox"
              checked={character.weaponProficiencies.simpleWeapons}
              onChange={toggleSimpleWeapons}
              className="mr-3 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="font-medium text-gray-800">Simple Weapons</span>
          </label>
          
          <label className="flex items-center text-sm hover:bg-blue-50 p-2 rounded-lg transition-colors">
            <input
              type="checkbox"
              checked={character.weaponProficiencies.martialWeapons}
              onChange={toggleMartialWeapons}
              className="mr-3 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="font-medium text-gray-800">Martial Weapons</span>
          </label>
        </div>

        {/* Specific Weapons */}
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Specific Weapons</h4>
          
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={specificWeaponInput}
              onChange={(e) => setSpecificWeaponInput(e.target.value)}
              className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Rapier, Longbow, etc."
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecificWeapon())}
            />
            <button
              onClick={addSpecificWeapon}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {character.weaponProficiencies.specificWeapons.map((weapon, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium"
              >
                {weapon}
                <button
                  onClick={() => removeSpecificWeapon(weapon)}
                  className="text-green-600 hover:text-green-800 ml-1"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          
          {character.weaponProficiencies.specificWeapons.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">No specific weapon proficiencies</p>
          )}
        </div>
      </div>
    </div>
  );
}; 