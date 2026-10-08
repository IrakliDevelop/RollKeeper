import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { Camera } from '@fieldnotes/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TableArrivalMarker, TableArrivalPicker } from './TablePartyArrival';

afterEach(cleanup);

function viewport() {
  const camera = new Camera();
  camera.setZoom(2);
  camera.moveTo(-100, -50);
  const domLayer = document.createElement('div');
  domLayer.getBoundingClientRect = () =>
    ({ left: 10, top: 20, width: 800, height: 600 }) as DOMRect;
  return { camera, domLayer };
}

describe('W11 arrival point picker and marker', () => {
  it('converts the next click to a world point through the real camera', () => {
    const vp = viewport();
    const onPick = vi.fn();
    render(
      <TableArrivalPicker viewport={vp} onPick={onPick} onCancel={vi.fn()} />
    );
    fireEvent.click(
      screen.getByRole('application', { name: /set the arrival point/u }),
      { clientX: 210, clientY: 120 }
    );
    expect(onPick).toHaveBeenCalledWith(
      vp.camera.screenToWorld({ x: 200, y: 100 })
    );
  });

  it('cancels with Escape', () => {
    const onCancel = vi.fn();
    render(
      <TableArrivalPicker
        viewport={viewport()}
        onPick={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(screen.getByRole('application'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('draws a DM-only DOM marker that follows the camera (no canvas element)', () => {
    const vp = viewport();
    const { container } = render(
      <TableArrivalMarker viewport={vp} point={{ x: 0, y: 0 }} />
    );
    const marker = container.firstElementChild as HTMLElement;
    const before = vp.camera.worldToScreen({ x: 0, y: 0 });
    expect(marker.style.left).toBe(`${before.x}px`);
    act(() => vp.camera.moveTo(40, 60));
    const after = vp.camera.worldToScreen({ x: 0, y: 0 });
    expect(after.x).not.toBe(before.x);
    expect(marker.style.left).toBe(`${after.x}px`);
    expect(marker.style.top).toBe(`${after.y}px`);
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('is a labelled, accent-coloured pin only when an arrival point exists (FU-10)', () => {
    const vp = viewport();
    const { rerender } = render(
      <TableArrivalMarker viewport={vp} point={{ x: 5, y: 5 }} />
    );
    const marker = screen.getByRole('img', { name: 'Party arrival point' });
    expect(marker).toHaveAttribute('title', 'Party arrival point');
    expect(marker.querySelector('svg')).not.toBeNull();
    expect(marker.innerHTML).toMatch(/text-accent-emerald-text/u);
    rerender(<TableArrivalMarker viewport={vp} point={null} />);
    expect(
      screen.queryByRole('img', { name: 'Party arrival point' })
    ).toBeNull();
  });
});
