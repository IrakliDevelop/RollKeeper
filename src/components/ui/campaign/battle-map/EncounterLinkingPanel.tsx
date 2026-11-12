'use client';

import { X } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { SelectField, SelectItem } from '@/components/ui/forms/select';

import { useEncounterStore } from '@/store/encounterStore';

interface EncounterLinkingPanelProps {
  campaignCode: string;
  linkedEncounterIds: string[];
  onLink: (encounterId: string) => void;
  onUnlink: (encounterId: string) => void;
}

const PLACEHOLDER = '__placeholder';

export default function EncounterLinkingPanel({
  campaignCode,
  linkedEncounterIds,
  onLink,
  onUnlink,
}: EncounterLinkingPanelProps) {
  const getEncountersByCampaign = useEncounterStore(
    s => s.getEncountersByCampaign
  );
  const encounters = getEncountersByCampaign(campaignCode);
  const availableEncounters = encounters.filter(
    e => !linkedEncounterIds.includes(e.id)
  );
  const linkedEncounters = encounters.filter(e =>
    linkedEncounterIds.includes(e.id)
  );

  return (
    <div className="border-divider border-t px-3 py-2">
      <span className="type-small text-heading font-medium">
        Linked encounters
      </span>

      {encounters.length === 0 ? (
        <p className="type-small text-muted mt-1">
          No encounters in this campaign
        </p>
      ) : (
        <>
          {availableEncounters.length > 0 && (
            <div className="mt-1.5">
              <SelectField
                value={PLACEHOLDER}
                onValueChange={(id: string) => {
                  if (id === PLACEHOLDER) return;
                  onLink(id);
                }}
                triggerProps={{ 'aria-label': 'Link an encounter…' }}
              >
                <SelectItem value={PLACEHOLDER} disabled>
                  Link an encounter…
                </SelectItem>
                {availableEncounters.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectField>
            </div>
          )}

          {linkedEncounters.length > 0 && (
            <ul className="mt-2">
              {linkedEncounters.map(e => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="type-small text-body truncate">
                    {e.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Unlink ${e.name}`}
                    onClick={() => onUnlink(e.id)}
                    className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  >
                    <X size={14} aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
