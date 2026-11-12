'use client';

import { CompactRichTextEditor } from '@/components/ui/forms/CompactRichTextEditor';

interface LoreTabProps {
  loreHtml: string;
  onChange: (html: string) => void;
}

export function LoreTab({ loreHtml, onChange }: LoreTabProps) {
  return (
    <div className="space-y-5">
      <CompactRichTextEditor
        content={loreHtml}
        onChange={onChange}
        ariaLabel="Lore"
        placeholder="Backstory, motives, secrets"
        minHeight="240px"
      />
      <p className="type-small text-muted">Players never see this.</p>
    </div>
  );
}
