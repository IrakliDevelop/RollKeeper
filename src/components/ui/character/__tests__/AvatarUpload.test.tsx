import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvatarUpload } from '../AvatarUpload';

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AvatarUpload portrait preview', () => {
  it('opens and closes a full-size preview when the avatar is read-only', () => {
    render(
      <AvatarUpload
        avatar="data:image/png;base64,cG9ydHJhaXQ="
        characterId="character-1"
        characterName="Thorin"
        onAvatarChange={vi.fn()}
        editable={false}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /view thorin image full size/i })
    );
    expect(
      screen.getByRole('dialog', {
        name: /thorin avatar full-size image/i,
      })
    ).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

it('keeps upload and remove inside an avatar menu and never submits a form', async () => {
  const submit = vi.fn();
  const changed = vi.fn();
  render(
    <form
      onSubmit={e => {
        e.preventDefault();
        submit();
      }}
    >
      <AvatarUpload
        avatar="data:image/png;base64,cA=="
        characterId="test"
        characterName="Thalia"
        onAvatarChange={changed}
      />
    </form>
  );
  expect(screen.queryByRole('button', { name: 'Remove avatar' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Change Thalia avatar' }));
  const remove = await screen.findByRole('button', { name: 'Remove avatar' });
  expect(remove).toHaveAttribute('type', 'button');
  expect(screen.getByRole('button', { name: 'Change avatar' })).toHaveAttribute(
    'type',
    'button'
  );
  fireEvent.click(remove);
  expect(changed).toHaveBeenCalledWith(undefined);
  expect(submit).not.toHaveBeenCalled();
});

it.each(['type', 'size'] as const)(
  'keeps %s validation inside the menu without submitting or uploading',
  async kind => {
    const submit = vi.fn();
    const changed = vi.fn();
    const request = vi.spyOn(globalThis, 'fetch');
    const { container } = render(
      <form
        onSubmit={event => {
          event.preventDefault();
          submit();
        }}
      >
        <AvatarUpload
          characterId="synthetic"
          characterName="Thalia"
          onAvatarChange={changed}
        />
      </form>
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Upload Thalia avatar' })
    );
    const file = new File(
      ['synthetic'],
      kind === 'type' ? 'fixture.txt' : 'fixture.png',
      { type: kind === 'type' ? 'text/plain' : 'image/png' }
    );
    if (kind === 'size')
      Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 });
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      kind === 'type'
        ? "That file isn't an image. Choose a PNG, JPG or WebP."
        : 'Up to 5 MB.'
    );
    if (kind === 'size')
      expect(screen.getAllByText('Up to 5 MB.')).toHaveLength(1);
    else expect(screen.queryByText('Up to 5 MB.')).toBeNull();
    expect(request).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    request.mockRestore();
  }
);
