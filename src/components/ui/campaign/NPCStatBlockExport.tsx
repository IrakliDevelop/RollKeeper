'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { Camera, Download, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import type { CampaignNPC, MonsterStatBlock } from '@/types/encounter';

// ── Dark-theme colour palette (hardcoded for image export) ──────────
const C = {
  bg: '#0f172a',
  cardBg: '#1e293b',
  heading: '#f1f5f9',
  body: '#cbd5e1',
  muted: '#94a3b8',
  faint: '#64748b',
  border: '#334155',
  accentRed: '#fca5a5',
  font: "system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;

// ── Helpers ─────────────────────────────────────────────────────────
function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Remove emoji characters (keeps basic symbols like +, -, etc.) */
function stripEmoji(text: string): string {
  return text.replace(
    /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu,
    ''
  );
}

/**
 * Strip ALL styling from rich-text HTML for clean image export.
 * Reference badges use Tailwind classes (bg-amber-500/10, etc.) and emoji
 * icons — these don't render in html-to-image. Replace with bold+italic+
 * underline plain text so they're still identifiable in the exported image.
 */
function cleanHtmlForExport(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  const walk = (node: Node): void => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;

        // Recurse into children first (bottom-up)
        walk(el);

        // Detect styled/classed spans (reference badges from referenceParser)
        const isStyledBadge =
          el.hasAttribute('style') ||
          el.hasAttribute('class') ||
          (el.tagName === 'SPAN' && el.getAttribute('title'));

        const text = stripEmoji(el.textContent || '').trim();

        if (isStyledBadge && text) {
          // Replace badge with bold+italic+underline plain text
          const replacement = document.createElement('b');
          const inner = document.createElement('i');
          const uline = document.createElement('u');
          uline.textContent = text;
          inner.appendChild(uline);
          replacement.appendChild(inner);
          el.replaceWith(replacement);
        } else if (isStyledBadge && !text) {
          // Empty after stripping emoji — remove entirely
          el.remove();
        } else {
          // Unstyled element — clean up attrs but keep structure
          el.removeAttribute('style');
          el.removeAttribute('class');
        }
      }
    }
  };

  walk(div);
  return stripEmoji(div.innerHTML);
}

async function toDataUrl(src: string): Promise<string | null> {
  try {
    const url =
      src.includes('s3.') && src.includes('amazonaws.com')
        ? `/api/assets/proxy?url=${encodeURIComponent(src)}`
        : src;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Pure inline-styled stat block (no CSS classes / custom props) ───
function InlineStatBlock({ sb }: { sb: MonsterStatBlock }) {
  const divider: React.CSSProperties = {
    borderTop: `1px solid ${C.border}`,
    paddingTop: 8,
    marginTop: 8,
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    color: C.heading,
    marginRight: 6,
    flexShrink: 0,
  };

  const valStyle: React.CSSProperties = { color: C.body };

  const row = (label: string, value: string | undefined) => {
    if (!value) return null;
    return (
      <div style={{ display: 'flex', gap: 6, padding: '2px 0', fontSize: 13 }}>
        <span style={labelStyle}>{label}</span>
        <span style={valStyle}>{value}</span>
      </div>
    );
  };

  const traitSection = (
    title: string,
    entries: Array<{ name: string; text: string }>
  ) => {
    if (!entries?.length) return null;
    return (
      <div style={{ ...divider }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: C.heading,
            borderBottom: `1px solid ${C.border}`,
            paddingBottom: 4,
            marginBottom: 6,
          }}
        >
          {title}
        </div>
        {entries.map((e, i) => (
          <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>
            <span
              style={{ fontWeight: 600, fontStyle: 'italic', color: C.heading }}
            >
              {e.name}.
            </span>{' '}
            <span
              style={{ color: C.body }}
              dangerouslySetInnerHTML={{ __html: cleanHtmlForExport(e.text) }}
            />
          </div>
        ))}
      </div>
    );
  };

  const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

  return (
    <div
      style={{
        border: `1px solid ${C.accentRed}`,
        borderRadius: 8,
        padding: 12,
        background: C.bg,
        fontFamily: C.font,
      }}
    >
      {/* Type line */}
      <div
        style={{
          fontSize: 12,
          fontStyle: 'italic',
          color: C.muted,
          marginBottom: 10,
        }}
      >
        {sb.size} {sb.type}
        {sb.alignment ? `, ${sb.alignment}` : ''}
        {sb.cr ? ` — CR ${sb.cr}` : ''}
      </div>

      {/* Ability scores */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 4,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {ABILITIES.map(a => (
          <div key={a}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: C.heading,
              }}
            >
              {a}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.heading }}>
              {sb[a]}
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>
              ({abilityMod(sb[a])})
            </div>
          </div>
        ))}
      </div>

      {/* Core rows */}
      <div style={divider}>
        {row('Speed', sb.speed)}
        {row('HP Formula', sb.hpFormula)}
        {row('Saves', sb.saves)}
        {row('Skills', sb.skills)}
      </div>

      {/* Defenses */}
      {(sb.resistances ||
        sb.immunities ||
        sb.vulnerabilities ||
        sb.conditionImmunities.length > 0) && (
        <div style={divider}>
          {row('Resistances', sb.resistances)}
          {row('Immunities', sb.immunities)}
          {row('Vulnerabilities', sb.vulnerabilities)}
          {sb.conditionImmunities.length > 0 &&
            row('Condition Immunities', sb.conditionImmunities.join(', '))}
        </div>
      )}

      {/* Senses & Languages */}
      <div style={divider}>
        {row(
          'Senses',
          sb.senses?.toLowerCase().includes('passive perception')
            ? sb.senses
            : sb.senses
              ? `${sb.senses}, passive Perception ${sb.passivePerception}`
              : `passive Perception ${sb.passivePerception}`
        )}
        {row('Languages', sb.languages)}
      </div>

      {/* Ability sections */}
      {traitSection('Traits', sb.traits)}
      {traitSection('Actions', sb.actions)}
      {traitSection('Bonus Actions', sb.bonusActions)}
      {traitSection('Reactions', sb.reactions)}
      {traitSection('Lair Actions', sb.lairActions)}
    </div>
  );
}

// ── Main export component ───────────────────────────────────────────
interface NPCStatBlockExportProps {
  npc: CampaignNPC;
}

export function NPCStatBlockExport({ npc }: NPCStatBlockExportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<
    'idle' | 'copying' | 'copied' | 'downloading'
  >('idle');
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);

  useEffect(() => {
    setAvatarDataUrl(null);
    if (!npc.avatarUrl) return;
    let cancelled = false;
    toDataUrl(npc.avatarUrl).then(d => {
      if (!cancelled) setAvatarDataUrl(d);
    });
    return () => {
      cancelled = true;
    };
  }, [npc.avatarUrl]);

  const captureImage = useCallback(async (): Promise<Blob | null> => {
    const el = containerRef.current;
    if (!el || !npc.monsterStatBlock) return null;

    // html-to-image clones the DOM and inlines getComputedStyle() on
    // every child. If the container is visibility:hidden, every child
    // inherits that computed value and gets it baked into its clone as
    // an inline style — making all content invisible in the output.
    // Fix: temporarily make the container visible (behind everything)
    // so computed styles resolve correctly, then hide it again.
    const prev = {
      visibility: el.style.visibility,
      position: el.style.position,
      left: el.style.left,
      top: el.style.top,
      zIndex: el.style.zIndex,
    };
    el.style.visibility = 'visible';
    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.top = '0';
    el.style.zIndex = '-1';

    try {
      const dataUrl = await toPng(el, { pixelRatio: 2 });
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch (err) {
      console.error('Failed to capture stat block:', err);
      return null;
    } finally {
      // Restore hidden state
      el.style.visibility = prev.visibility;
      el.style.position = prev.position;
      el.style.left = prev.left;
      el.style.top = prev.top;
      el.style.zIndex = prev.zIndex;
    }
  }, [npc.monsterStatBlock]);

  const handleCopy = useCallback(async () => {
    setStatus('copying');
    try {
      const blob = await captureImage();
      if (!blob) {
        setStatus('idle');
        return;
      }
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy stat block image:', err);
      setStatus('idle');
    }
  }, [captureImage]);

  const handleDownload = useCallback(async () => {
    setStatus('downloading');
    try {
      const blob = await captureImage();
      if (!blob) {
        setStatus('idle');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${npc.name.toLowerCase().replace(/\s+/g, '-')}-statblock.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('idle');
    } catch (err) {
      console.error('Failed to download stat block image:', err);
      setStatus('idle');
    }
  }, [captureImage, npc.name]);

  if (!npc.monsterStatBlock) return null;

  return (
    <>
      {/* Hidden offscreen render container — 100% inline styles */}
      <div
        ref={containerRef}
        aria-hidden
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          width: '900px',
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            padding: 24,
            background: C.cardBg,
            fontFamily: C.font,
            color: C.body,
          }}
        >
          {/* NPC header with portrait */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              marginBottom: 16,
            }}
          >
            {avatarDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarDataUrl}
                alt={npc.name}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 8,
                  objectFit: 'cover',
                }}
              />
            )}
            <div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: C.heading,
                  margin: '0 0 4px',
                }}
              >
                {npc.name}
              </div>
              <div
                style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}
              >
                {npc.monsterStatBlock.size} {npc.monsterStatBlock.type}
                {npc.monsterStatBlock.alignment
                  ? `, ${npc.monsterStatBlock.alignment}`
                  : ''}
              </div>
            </div>
          </div>

          <InlineStatBlock sb={npc.monsterStatBlock} />
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          disabled={status === 'copying' || status === 'downloading'}
        >
          {status === 'copying' ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : status === 'copied' ? (
            <Check className="mr-1.5 h-4 w-4" />
          ) : (
            <Camera className="mr-1.5 h-4 w-4" />
          )}
          {status === 'copied' ? 'Copied!' : 'Copy as Image'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={status === 'copying' || status === 'downloading'}
        >
          {status === 'downloading' ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-4 w-4" />
          )}
          Download PNG
        </Button>
      </div>
    </>
  );
}
