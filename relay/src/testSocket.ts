import WebSocket from 'ws';
import { createCurrentCapabilities } from '@fieldnotes/sync';

/** Raw integration-test peer for the current versioned legacy protocol. */
export default class TestSocket extends WebSocket {
  private versions = new Map<string, number>();
  constructor(url: string) {
    super(url);
    this.once('open', () =>
      this.send(
        JSON.stringify({
          from: 'test-peer',
          op: {
            kind: 'capabilities',
            capabilities: createCurrentCapabilities(['fog']),
          },
        })
      )
    );
  }
  override send(
    data: Parameters<WebSocket['send']>[0],
    optionsOrCallback?:
      | Parameters<WebSocket['send']>[1]
      | ((err?: Error) => void),
    callback?: (err?: Error) => void
  ): void {
    const message = JSON.parse(String(data));
    const op = message.op;
    if (op.kind === 'upsert') {
      const el = op.element;
      el.index ||= 'a0';
      el.version ||= (this.versions.get(el.id) ?? 0) + 1;
      el.editor ||= message.from;
      this.versions.set(el.id, el.version);
      delete el.zIndex;
    }
    if (op.kind === 'remove') {
      op.version ??= (this.versions.get(op.id) ?? 0) + 1;
      op.editor ??= message.from;
    }
    if (op.kind === 'clear') op.tombstones ??= [];
    if (typeof optionsOrCallback === 'function')
      super.send(JSON.stringify(message), optionsOrCallback);
    else super.send(JSON.stringify(message), optionsOrCallback ?? {}, callback);
  }
}
