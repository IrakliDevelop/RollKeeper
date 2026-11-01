'use client';

import React, { useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { X } from 'lucide-react';
import { Checkbox, Input, Button } from '@/components/ui/forms';
import { Section } from '@/components/ui/layout/section';
import { Badge } from '@/components/ui/layout/badge';

export const WeaponProficiencies = ({
  editing = true,
}: {
  editing?: boolean;
}) => {
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

  const proficiencies = character.weaponProficiencies;
  const names = [
    ...(proficiencies.simpleWeapons ? ['Simple weapons'] : []),
    ...(proficiencies.martialWeapons ? ['Martial weapons'] : []),
    ...proficiencies.specificWeapons,
  ];
  return (
    <Section heading="Weapon proficiencies">
      {!editing ? (
        <p className="type-body text-body">
          {names.join(', ') || 'No specific weapon proficiencies'}
        </p>
      ) : (
        <div className="space-y-3">
          <Checkbox
            checked={proficiencies.simpleWeapons}
            onCheckedChange={toggleSimpleWeapons}
            label="Simple weapons"
          />
          <Checkbox
            checked={proficiencies.martialWeapons}
            onCheckedChange={toggleMartialWeapons}
            label="Martial weapons"
          />
          <div className="flex items-end gap-2">
            <Input
              label="Specific weapons"
              value={specificWeaponInput}
              onChange={e => setSpecificWeaponInput(e.target.value)}
              placeholder="Rapier"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSpecificWeapon();
                }
              }}
            />
            <Button
              aria-label="Add weapon proficiency"
              onClick={addSpecificWeapon}
            >
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {proficiencies.specificWeapons.map(weapon => (
              <Badge key={weapon}>
                {weapon}
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={`Remove ${weapon} proficiency`}
                  onClick={() => removeSpecificWeapon(weapon)}
                >
                  <X size={12} />
                </Button>
              </Badge>
            ))}
          </div>
          {proficiencies.specificWeapons.length === 0 && (
            <p className="type-small text-muted">
              No specific weapon proficiencies
            </p>
          )}
        </div>
      )}
    </Section>
  );
};
