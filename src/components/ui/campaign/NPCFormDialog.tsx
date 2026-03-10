'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/feedback/dialog-new';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { CampaignNPC } from '@/types/encounter';

interface NPCFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<CampaignNPC, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editingNpc?: CampaignNPC | null;
}

export function NPCFormDialog({
  open,
  onOpenChange,
  onSave,
  editingNpc,
}: NPCFormDialogProps) {
  const [name, setName] = useState('');
  const [hp, setHp] = useState('10');
  const [ac, setAc] = useState('10');
  const [speed, setSpeed] = useState('30 ft.');
  const [description, setDescription] = useState('');
  const [showAbilityScores, setShowAbilityScores] = useState(false);
  const [str, setStr] = useState('10');
  const [dex, setDex] = useState('10');
  const [con, setCon] = useState('10');
  const [int, setInt] = useState('10');
  const [wis, setWis] = useState('10');
  const [cha, setCha] = useState('10');

  useEffect(() => {
    if (editingNpc) {
      setName(editingNpc.name);
      setHp(editingNpc.maxHp.toString());
      setAc(editingNpc.armorClass.toString());
      setSpeed(editingNpc.speed);
      setDescription(editingNpc.description ?? '');
      if (editingNpc.abilityScores) {
        setShowAbilityScores(true);
        setStr(editingNpc.abilityScores.str.toString());
        setDex(editingNpc.abilityScores.dex.toString());
        setCon(editingNpc.abilityScores.con.toString());
        setInt(editingNpc.abilityScores.int.toString());
        setWis(editingNpc.abilityScores.wis.toString());
        setCha(editingNpc.abilityScores.cha.toString());
      } else {
        setShowAbilityScores(false);
      }
    } else {
      setName('');
      setHp('10');
      setAc('10');
      setSpeed('30 ft.');
      setDescription('');
      setShowAbilityScores(false);
      setStr('10');
      setDex('10');
      setCon('10');
      setInt('10');
      setWis('10');
      setCha('10');
    }
  }, [editingNpc, open]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      maxHp: parseInt(hp) || 10,
      armorClass: parseInt(ac) || 10,
      speed: speed.trim() || '30 ft.',
      description: description.trim() || undefined,
      abilityScores: showAbilityScores
        ? {
            str: parseInt(str) || 10,
            dex: parseInt(dex) || 10,
            con: parseInt(con) || 10,
            int: parseInt(int) || 10,
            wis: parseInt(wis) || 10,
            cha: parseInt(cha) || 10,
          }
        : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingNpc ? 'Edit NPC' : 'Create NPC'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="NPC name"
              label="Name"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleSubmit();
              }}
            />
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description (optional)"
              label="Description"
            />
            <div className="grid grid-cols-3 gap-3">
              <Input
                value={hp}
                onChange={e => setHp(e.target.value)}
                label="HP"
                type="number"
              />
              <Input
                value={ac}
                onChange={e => setAc(e.target.value)}
                label="AC"
                type="number"
              />
              <Input
                value={speed}
                onChange={e => setSpeed(e.target.value)}
                label="Speed"
              />
            </div>

            <button
              onClick={() => setShowAbilityScores(!showAbilityScores)}
              className="text-accent-purple-text text-sm font-medium hover:underline"
            >
              {showAbilityScores ? 'Hide Ability Scores' : 'Add Ability Scores'}
            </button>

            {showAbilityScores && (
              <div className="grid grid-cols-6 gap-2">
                {[
                  { label: 'STR', value: str, set: setStr },
                  { label: 'DEX', value: dex, set: setDex },
                  { label: 'CON', value: con, set: setCon },
                  { label: 'INT', value: int, set: setInt },
                  { label: 'WIS', value: wis, set: setWis },
                  { label: 'CHA', value: cha, set: setCha },
                ].map(({ label, value, set }) => (
                  <div key={label}>
                    <label className="text-muted mb-1 block text-center text-[10px] font-medium uppercase">
                      {label}
                    </label>
                    <input
                      type="number"
                      value={value}
                      onChange={e => set(e.target.value)}
                      className="bg-surface-secondary text-heading w-full rounded px-1 py-1 text-center text-sm font-medium"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={!name.trim()}
              >
                {editingNpc ? 'Save Changes' : 'Create NPC'}
              </Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
