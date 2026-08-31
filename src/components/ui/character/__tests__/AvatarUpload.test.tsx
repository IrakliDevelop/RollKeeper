import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvatarUpload } from '../AvatarUpload';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    return <img {...rest} />;
  },
}));

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
