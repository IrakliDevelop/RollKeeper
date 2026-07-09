'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/feedback/dialog';
import ArmorClassManager from '@/components/ui/character/ArmorClassManager';
import { useCharacterStore } from '@/store/characterStore';

interface AcEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Dock AC editing = the sheet's ArmorClassManager in a dialog, wired to the
 * same store actions the Combat tab uses (base AC, shield, temp AC). */
export function AcEditDialog({ open, onOpenChange }: AcEditDialogProps) {
  const character = useCharacterStore(s => s.character);
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const updateTempArmorClass = useCharacterStore(s => s.updateTempArmorClass);
  const toggleTempAC = useCharacterStore(s => s.toggleTempAC);
  const toggleShield = useCharacterStore(s => s.toggleShield);
  const updateShieldBonus = useCharacterStore(s => s.updateShieldBonus);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Armor Class</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <ArmorClassManager
            character={character}
            onUpdateArmorClass={ac => updateCharacter({ armorClass: ac })}
            onUpdateTempArmorClass={updateTempArmorClass}
            onToggleTempAC={toggleTempAC}
            onToggleShield={toggleShield}
            onUpdateShieldBonus={updateShieldBonus}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
