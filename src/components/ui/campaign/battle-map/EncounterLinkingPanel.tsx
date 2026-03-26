'use client';

import { useEncounterStore } from '@/store/encounterStore';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Badge } from '@/components/ui/layout/badge';
import { X } from 'lucide-react';

interface EncounterLinkingPanelProps {
  campaignCode: string;
  linkedEncounterIds: string[];
  onLink: (encounterId: string) => void;
  onUnlink: (encounterId: string) => void;
}

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
      <span className="text-heading text-xs font-semibold">
        Linked Encounters
      </span>

      {encounters.length === 0 ? (
        <p className="text-muted mt-1 text-xs">
          No encounters in this campaign
        </p>
      ) : (
        <>
          {availableEncounters.length > 0 && (
            <div className="mt-1.5">
              <SelectField
                label=""
                value=""
                onValueChange={(id: string) => onLink(id)}
              >
                <SelectItem value="__placeholder" disabled>
                  Link an encounter...
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
            <div className="mt-2 flex flex-wrap gap-1">
              {linkedEncounters.map(e => (
                <Badge
                  key={e.id}
                  variant="info"
                  className="flex items-center gap-1 text-xs"
                >
                  {e.name}
                  <button
                    onClick={() => onUnlink(e.id)}
                    className="hover:text-accent-red-text ml-0.5"
                  >
                    <X size={10} />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
