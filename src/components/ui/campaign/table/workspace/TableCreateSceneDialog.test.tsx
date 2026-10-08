import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TableRepository } from '@/lib/table/repository';
import { useBattleMapStore } from '@/store/battleMapStore';

import { TableCreateSceneDialog } from './TableCreateSceneDialog';

let repository: TableRepository;

beforeEach(async () => {
  repository = new TableRepository({
    factory: new IDBFactory(),
    selection: {
      account: { kind: 'guest' },
      workspace: { localWorkspaceId: 'w1', sourceCampaignCode: 'CAMP' },
    },
    broadcastChannel: null,
    events: null,
  });
  await repository.start();
});
afterEach(() => {
  cleanup();
  repository.dispose();
  vi.restoreAllMocks();
});

const scenes = () => {
  const current = repository.getCurrent();
  return current?.status === 'ready' ? current.snapshot.scenes : [];
};

function setup(
  options: {
    upload?: (file: Blob, assetId: string) => Promise<string>;
    decode?: (file: File) => Promise<{ w: number; h: number }>;
  } = {}
) {
  const onCreated = vi.fn();
  const upload =
    options.upload ??
    vi.fn(
      async () => 'https://bucket.s3.eu-west-1.amazonaws.com/maps/new.webp'
    );
  const decode = options.decode ?? vi.fn(async () => ({ w: 1600, h: 900 }));
  render(
    <TableCreateSceneDialog
      open
      onOpenChange={vi.fn()}
      repository={repository}
      onCreated={onCreated}
      upload={upload}
      decode={decode}
    />
  );
  return { onCreated, upload, decode };
}

const typeName = (name: string) =>
  fireEvent.change(screen.getByLabelText('Scene name'), {
    target: { value: name },
  });

const chooseFile = (file: File) => {
  fireEvent.click(screen.getByRole('button', { name: 'Image' }));
  fireEvent.change(screen.getByLabelText('Map image file'), {
    target: { files: [file] },
  });
};

const image = (type = 'image/webp', name = 'map.webp') =>
  new File([new Uint8Array(8)], name, { type });

describe('W6 create scene dialog', () => {
  it('creates a blank scene and selects it', async () => {
    const storeWrite = vi.spyOn(useBattleMapStore, 'setState');
    const { onCreated, upload } = setup();
    typeName('Forest');
    fireEvent.click(screen.getByRole('button', { name: 'Create scene' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const [created] = scenes();
    expect(created).toMatchObject({
      originalMapId: null,
      map: { name: 'Forest', mapImageUrl: '', mapImageSize: { w: 0, h: 0 } },
      canvasCheckpoint: null,
    });
    expect(onCreated).toHaveBeenCalledWith(created!.sceneId);
    expect(upload).not.toHaveBeenCalled();
    expect(storeWrite).not.toHaveBeenCalled();
  });

  it('requires a name', async () => {
    const { onCreated } = setup();
    typeName('   ');
    fireEvent.click(screen.getByRole('button', { name: 'Create scene' }));
    expect(
      await screen.findByText('Name the scene (1–200 characters).')
    ).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(scenes()).toEqual([]);
  });

  it('creates an image scene from an uploaded https image with its natural size', async () => {
    const { onCreated, upload } = setup();
    typeName('Tavern');
    chooseFile(image());
    fireEvent.click(screen.getByRole('button', { name: 'Create scene' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(upload).toHaveBeenCalledTimes(1);
    expect(scenes()[0]!.map).toMatchObject({
      name: 'Tavern',
      mapImageUrl: 'https://bucket.s3.eu-west-1.amazonaws.com/maps/new.webp',
      mapImageSize: { w: 1600, h: 900 },
    });
  });

  it.each([
    [
      'a video',
      image('video/mp4', 'map.mp4'),
      'Choose a PNG, JPEG, WebP or GIF image',
    ],
    [
      'an SVG',
      image('image/svg+xml', 'map.svg'),
      'Choose a PNG, JPEG, WebP or GIF image',
    ],
  ])(
    'refuses %s with a visible error and creates no scene',
    async (_label, file, message) => {
      const { onCreated, upload } = setup();
      typeName('Bad');
      chooseFile(file);
      fireEvent.click(screen.getByRole('button', { name: 'Create scene' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(upload).not.toHaveBeenCalled();
      expect(onCreated).not.toHaveBeenCalled();
      expect(scenes()).toEqual([]);
    }
  );

  it.each([
    [
      'an undecodable image',
      {
        decode: vi.fn(async () => {
          throw new Error('bad');
        }),
      },
      'This image could not be read',
    ],
    [
      'a zero-size image',
      { decode: vi.fn(async () => ({ w: 0, h: 0 })) },
      'Image must be between 1 and 16384 pixels on each side',
    ],
    [
      'an upload failure',
      {
        upload: vi.fn(async () => {
          throw new Error('Asset uploads are not configured');
        }),
      },
      'Upload failed: Asset uploads are not configured',
    ],
    [
      'a non-https upload result',
      { upload: vi.fn(async () => 'http://insecure.test/a.webp') },
      'Upload did not return a secure image link',
    ],
  ])('refuses %s and creates no scene', async (_label, options, message) => {
    const { onCreated } = setup(options);
    typeName('Bad');
    chooseFile(image());
    fireEvent.click(screen.getByRole('button', { name: 'Create scene' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(onCreated).not.toHaveBeenCalled();
    expect(scenes()).toEqual([]);
  });

  it('asks for a file when Image is chosen without one', async () => {
    const { onCreated } = setup();
    typeName('Tavern');
    fireEvent.click(screen.getByRole('button', { name: 'Image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create scene' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a map image or create a blank scene.'
    );
    expect(onCreated).not.toHaveBeenCalled();
  });
});
