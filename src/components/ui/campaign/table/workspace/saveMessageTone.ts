/**
 * O7-2 HN-1 / HR-1: how a Table save/scene message is shown. `routine`
 * lines live in Details; every other message is a header banner (polite
 * status region); `failure` uses the failure tone and counts on Details.
 * Sources may tag a message explicitly (export errors carry arbitrary
 * text); otherwise the message is classified by this explicit list.
 */
export type SaveMessageTone = 'routine' | 'progress' | 'success' | 'failure';

const ROUTINE = new Set(['Local scene loading…', 'Local scene ready']);
const FAILURE = [
  /not committed/u,
  /is not ready/u,
  /is unavailable/u,
  /^Scene not found in this local workspace$/u,
  /was not restored because live authority changed/u,
  / failed \(/u,
  /could not be refreshed/u,
  /could not be applied/u,
  /^The scene changed again/u,
  /^The arrival point was not saved/u,
  /^Map image could not be loaded/u,
];

export function saveMessageTone(
  message: string,
  tagged?: SaveMessageTone
): SaveMessageTone {
  if (tagged) return tagged;
  if (ROUTINE.has(message)) return 'routine';
  if (FAILURE.some(pattern => pattern.test(message))) return 'failure';
  return message.endsWith('…') ? 'progress' : 'success';
}

/** Export errors carry arbitrary text: report them tagged as failures. */
export function exportFailureReporter(
  notify: (message: string, tone?: SaveMessageTone) => void
): (message: string) => void {
  return message => notify(message, 'failure');
}
