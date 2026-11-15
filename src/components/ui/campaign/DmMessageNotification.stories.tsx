import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DmMessageNotification } from './DmMessageNotification';
import { sanitizeRichText } from '@/utils/sanitizeRichText';
import {
  EDITOR_FIXTURE_HTML,
  HOSTILE_CASES,
  UNCHANGED_INPUTS,
} from '@/utils/sanitizeRichText.fixtures';

const meta: Meta<typeof DmMessageNotification> = {
  component: DmMessageNotification,
  args: {
    onAccept: fn(),
    onDismiss: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof DmMessageNotification>;

/**
 * A message holding everything the DM's editor can write. The play test runs
 * in real Chromium: the sanitiser gives the same strings the Node test pins,
 * and the rendered message is the DOM the browser builds from the raw HTML.
 */
export const EditorFormatting: Story = {
  args: {
    messages: [
      {
        id: 'formatting',
        title: 'Session notes',
        content: EDITOR_FIXTURE_HTML,
        sentAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    for (const input of UNCHANGED_INPUTS) {
      await expect(sanitizeRichText(input)).toBe(input);
    }
    for (const c of HOSTILE_CASES) {
      await expect(sanitizeRichText(c.input), c.name).toBe(c.expected);
    }

    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Read message' }));
    const body = canvas.getByRole('heading', {
      name: 'Heading 1',
    }).parentElement!;
    const expected = document.createElement('div');
    expected.className = body.className;
    expected.innerHTML = EDITOR_FIXTURE_HTML;
    await expect(body.isEqualNode(expected)).toBe(true);
  },
};

// An unclosed tag swallows whatever follows it, so those cases go last,
// after a marker paragraph that proves everything before them rendered.
const swallowsRest = (name: string) => /unclosed|unterminated/.test(name);
const HOSTILE_MESSAGE = [
  ...HOSTILE_CASES.filter(c => !swallowsRest(c.name)).map(c => c.input),
  '<p>End of scroll</p>',
  ...HOSTILE_CASES.filter(c => swallowsRest(c.name)).map(c => c.input),
].join('');

/** A message carrying script, handlers and unsafe links renders inert. */
export const HostileMessage: Story = {
  args: {
    messages: [
      {
        id: 'hostile',
        title: 'Bad scroll',
        content: HOSTILE_MESSAGE,
        sentAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Read message' }));
    const body = canvas.getAllByText('Hi')[0].parentElement!;
    await expect(canvas.getByText('End of scroll')).toBeVisible();
    for (const tag of [
      'script',
      'style',
      'img',
      'iframe',
      'svg',
      'math',
      'form',
      'input',
      'object',
      'base',
      'meta',
      'link',
    ]) {
      await expect(body.querySelector(tag), tag).toBeNull();
    }
    for (const el of body.querySelectorAll('*')) {
      for (const attr of el.attributes) {
        await expect(attr.name).not.toMatch(/^on|^src|^action|^formaction/);
      }
    }
    for (const a of body.querySelectorAll('a[href]')) {
      const url = new URL(a.getAttribute('href')!, window.location.href);
      await expect(['http:', 'https:', 'mailto:']).toContain(url.protocol);
    }
  },
};
