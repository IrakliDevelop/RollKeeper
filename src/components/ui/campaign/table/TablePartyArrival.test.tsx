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
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () =>
    ({
      left: 10,
      top: 20,
      right: 810,
      bottom: 620,
      width: 800,
      height: 600,
    }) as DOMRect;
  const domLayer = document.createElement('div');
  wrapper.appendChild(domLayer);
  // The SDK transforms this layer with the camera. Its rect must never be
  // used as the origin for pointer coordinates or the arrival pin.
  domLayer.getBoundingClientRect = () =>
    ({ left: -190, top: -80, right: 1410, bottom: 1120 }) as DOMRect;
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

  it('round-trips a click back to the same screen position at pan and zoom', () => {
    const vp = viewport();
    let point: { x: number; y: number } | null = null;
    const { rerender } = render(
      <TableArrivalPicker
        viewport={vp}
        onPick={picked => {
          point = picked;
        }}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('application'), {
      clientX: 210,
      clientY: 120,
    });
    expect(point).not.toBeNull();
    rerender(<TableArrivalMarker viewport={vp} point={point} />);
    const marker = screen.getByRole('img', { name: 'Party arrival point' });
    expect(marker).toHaveStyle({ left: '210px', top: '120px' });
  });

  it('ignores clicks outside the canvas wrapper', () => {
    const onPick = vi.fn();
    render(
      <TableArrivalPicker
        viewport={viewport()}
        onPick={onPick}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('application'), {
      clientX: 900,
      clientY: 120,
    });
    expect(onPick).not.toHaveBeenCalled();
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
    expect(marker.style.left).toBe(`${before.x + 10}px`);
    expect(marker.style.top).toBe(`${before.y + 20}px`);
    act(() => vp.camera.moveTo(40, 60));
    const after = vp.camera.worldToScreen({ x: 0, y: 0 });
    expect(after.x).not.toBe(before.x);
    expect(marker.style.left).toBe(`${after.x + 10}px`);
    expect(marker.style.top).toBe(`${after.y + 20}px`);
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('is a labelled pin using semantic tokens only when an arrival point exists (FU-10)', () => {
    const vp = viewport();
    const { rerender } = render(
      <TableArrivalMarker viewport={vp} point={{ x: 5, y: 5 }} />
    );
    const marker = screen.getByRole('img', { name: 'Party arrival point' });
    expect(marker).toHaveAttribute('title', 'Party arrival point');
    expect(marker.querySelector('svg')).not.toBeNull();
    const pin = marker.querySelector('svg')!;
    expect(pin).toHaveClass('text-verdigris-text', 'fill-verdigris-bg');
    expect(screen.getByText('Arrival')).toHaveClass(
      'bg-verdigris-bg',
      'text-verdigris-text',
      'border-verdigris-border'
    );
    rerender(<TableArrivalMarker viewport={vp} point={null} />);
    expect(
      screen.queryByRole('img', { name: 'Party arrival point' })
    ).toBeNull();
  });
});
