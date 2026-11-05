import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useLayoutEffect, useRef, useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import type { TableSceneRecordV1 } from '@/lib/table/schema';
import type {
  TableControlSession,
  TableDescriptor,
} from '@/lib/table/authorityLifecycle';
import type { TablePresentationPanel } from '../presentation';
import { TableSceneBrowser, TableScenesToggle } from './TableSceneBrowser';
import { TableWorkspaceHeader } from './TableWorkspaceHeader';

const AT = '2026-10-08T00:00:00.000Z';
function scene(sceneId: string, name: string): TableSceneRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey: 'guest/workspace:synthetic',
    sceneId,
    originalMapId: null,
    map: {
      name,
      mapImageUrl: '',
      mapImageSize: { w: 0, h: 0 },
      gridEnabled: true,
      gridSettings: null,
      markers: [],
      dmOnlyElements: {},
    },
    canvasCheckpoint: null,
    members: [],
    arrivalPoint: null,
    createdAt: AT,
    updatedAt: AT,
  };
}
const SCENES = [
  scene('tavern', 'Tavern'),
  scene(
    'forest',
    'The Very Long Forest Scene Name Beyond the Northern Mountains'
  ),
  scene('crypt', 'Crypt'),
];
const noop = () => undefined;

function Controls({
  manyScenes = false,
  offline = false,
  notice = false,
  blanked = false,
}: {
  manyScenes?: boolean;
  offline?: boolean;
  notice?: boolean;
  blanked?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [selectedId, setSelectedId] = useState('forest');
  const [shown, setShown] = useState({
    sceneId: 'tavern' as string | null,
    blanked,
  });
  const dock = useRef<HTMLDivElement>(null);
  const scenes = manyScenes
    ? [
        ...SCENES,
        ...Array.from({ length: 18 }, (_, index) =>
          scene(`scene-${index}`, `Dungeon room ${index + 1}`)
        ),
      ]
    : SCENES;
  const selected = scenes.find(item => item.sceneId === selectedId)!;
  useLayoutEffect(() => {
    const update = () =>
      document.documentElement.style.setProperty(
        '--dm-vtt-panel-top',
        `${Math.ceil(dock.current!.getBoundingClientRect().bottom + 8)}px`
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(dock.current!);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--dm-vtt-panel-top');
    };
  }, []);
  const descriptor: TableDescriptor = {
    epoch: 'synthetic',
    revision: 1,
    writerFence: 1,
    leaseUntil: 0,
    holderSessionId: 'synthetic',
    presentation: { ...shown, revision: 1 },
    publicRunId: null,
  };
  const authorityState = offline
    ? { phase: 'offline' as const }
    : { phase: 'ready' as const, session: {} as TableControlSession };
  const panel: TablePresentationPanel = {
    presentation: {
      descriptor,
      labels: Object.fromEntries(
        scenes.map(item => [
          item.sceneId,
          { safeLabel: item.map.name, sourceMapId: `map-${item.sceneId}` },
        ])
      ),
      pending: false,
      message: null,
      holder: !offline,
      committedCount: 0,
      show: () => setShown({ sceneId: selectedId, blanked: false }),
      reveal: () => setShown(current => ({ ...current, blanked: false })),
      blank: () => setShown(current => ({ ...current, blanked: true })),
      unpresent: () => setShown({ sceneId: null, blanked: false }),
      retry: noop,
    },
    display: {
      status: {
        state: 'loaded',
        sceneId: shown.sceneId,
        ageMs: 1000,
        calibration: 'verified',
      },
      refresh: noop,
    },
    verifiedSeen: true,
  };
  return (
    <main className="bg-surface-inset relative min-h-screen">
      <div
        ref={dock}
        className="border-divider bg-surface fixed inset-x-0 top-0 border-b"
      >
        <TableWorkspaceHeader
          campaignCode="SYNTHETIC"
          leading={
            <TableScenesToggle
              open={open}
              onToggle={() => setOpen(current => !current)}
            />
          }
          authority={{
            state: authorityState,
            waitSeconds: 0,
            acquire: noop,
            workOffline: noop,
          }}
          clearedNotice={false}
          presentationProps={{
            campaignCode: 'SYNTHETIC',
            dmId: 'synthetic',
            sceneId: selectedId,
            sceneName: selected.map.name,
            authorityState,
            session: null,
            descriptor,
          }}
          presentation={panel}
          notices={
            notice
              ? [
                  {
                    id: 'scale',
                    tone: 'alert',
                    text: 'TV says the scale needs checking. Use Check scale on the TV.',
                  },
                ]
              : []
          }
          scene={{
            name: selected.map.name,
            stored: selected,
            relayStatus: offline ? 'offline' : 'live',
            pendingConflict: null,
            checkpoint: {
              saveMessage: 'Scene ready',
              saveTone: 'routine',
              saveDetail: undefined,
              recoveryBusy: false,
              saveBusy: false,
              live: !offline,
              restore: async () => {},
              reapplyOfflineFork: async () => {},
              discardOfflineFork: async () => {},
              saveCheckpoint: async () => {},
              reconcilePendingEdit: async () => {},
            },
          }}
        />
      </div>
      <TableSceneBrowser
        open={open}
        onClose={() => setOpen(false)}
        scenes={scenes}
        selectedSceneId={selectedId}
        presentation={shown}
        onSelect={setSelectedId}
        onCreate={noop}
        adoptable={[{ id: 'map-gate', name: 'Castle gate' }]}
        onAdopt={noop}
        battleMapsHref="/dm/campaign/SYNTHETIC/battlemaps"
      />
    </main>
  );
}

const VIEWPORTS = {
  shortDesktop: {
    name: 'Short desktop',
    styles: { width: '1280px', height: '720px' },
    type: 'desktop',
  },
  smallest: {
    name: 'Small phone',
    styles: { width: '320px', height: '800px' },
    type: 'mobile',
  },
  desktop: {
    name: 'Desktop',
    styles: { width: '1440px', height: '1000px' },
    type: 'desktop',
  },
  landscape: {
    name: 'iPad landscape',
    styles: { width: '1024px', height: '768px' },
    type: 'tablet',
  },
  portrait: {
    name: 'iPad portrait',
    styles: { width: '768px', height: '1024px' },
    type: 'tablet',
  },
  phone: {
    name: 'Phone',
    styles: { width: '390px', height: '844px' },
    type: 'mobile',
  },
  narrow: {
    name: 'Narrow phone',
    styles: { width: '360px', height: '800px' },
    type: 'mobile',
  },
};
const meta: Meta<typeof Controls> = {
  title: 'Campaign/Table workspace controls',
  component: Controls,
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
    viewport: { options: VIEWPORTS },
  },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const panel = canvas.getByRole('region', { name: 'Scenes' });
    const doc = canvasElement.ownerDocument.documentElement;
    await expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth);
    const box = panel.getBoundingClientRect();
    await expect(box.bottom).toBeLessThanOrEqual(window.innerHeight);
    await expect(box.top).toBeGreaterThanOrEqual(
      canvas.getByTestId('table-workspace-header').getBoundingClientRect()
        .bottom
    );
    const scroll = panel.querySelector<HTMLElement>('.overflow-y-auto')!;
    if (args.manyScenes)
      await expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
    else if (window.innerWidth >= 768)
      await expect(box.bottom).toBeLessThan(window.innerHeight - 40);
    await expect(
      canvas.getByRole('status', { name: 'What players see' })
    ).toHaveTextContent(
      args.blanked ? 'Players see: blank screen' : 'Players see: Tavern'
    );
    await userEvent.click(within(panel).getByRole('button', { name: /Crypt/ }));
    await expect(
      canvas.getByRole('status', { name: 'What players see' })
    ).toHaveTextContent(
      args.blanked ? 'Players see: blank screen' : 'Players see: Tavern'
    );
    await expect(
      within(panel).getByRole('button', { name: /Crypt/ })
    ).toHaveAttribute('aria-current', 'true');
    await expect(
      canvasElement.querySelectorAll('button[data-variant="primary"]')
    ).toHaveLength(1);
    const restore = emulateCoarsePointer();
    try {
      for (const control of [
        ...canvas.getAllByRole('button'),
        ...canvas.getAllByRole('link'),
      ]) {
        const rect = control.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        await expect(Math.round(rect.height)).toBeGreaterThanOrEqual(44);
        await expect(Math.round(rect.width)).toBeGreaterThanOrEqual(44);
      }
      await expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth);
    } finally {
      restore();
    }
    await userEvent.click(
      within(panel).getByRole('button', { name: 'Close scenes' })
    );
    await expect(canvas.queryByRole('region', { name: 'Scenes' })).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Scenes' })).toHaveFocus();
  },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Desktop: Story = {};
export const BlueDesktop: Story = {
  globals: { theme: 'blue' },
  args: { blanked: true },
};
export const Landscape: Story = {
  globals: {
    theme: 'dark',
    viewport: { value: 'landscape', isRotated: false },
  },
};
export const Portrait: Story = {
  globals: { viewport: { value: 'portrait', isRotated: false } },
};
export const Phone: Story = {
  globals: { theme: 'blue', viewport: { value: 'phone', isRotated: false } },
};
export const LongList: Story = { args: { manyScenes: true } };
export const NarrowOffline: Story = {
  args: { offline: true, manyScenes: true, notice: true },
  globals: { theme: 'dark', viewport: { value: 'narrow', isRotated: false } },
};

export const ShortDesktop: Story = {
  globals: { viewport: { value: 'shortDesktop', isRotated: false } },
};
export const SmallPhone: Story = {
  globals: { theme: 'blue', viewport: { value: 'smallest', isRotated: false } },
};
