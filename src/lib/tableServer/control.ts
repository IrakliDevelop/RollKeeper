import { createHash, randomUUID } from 'node:crypto';
import type { Redis } from '@upstash/redis';
import { getRawRedis, campaignSharedKey } from '@/lib/redis';
import { TABLE_CONTROL_SCRIPT } from './atomic';
import type { TableCommand } from './validation';

export interface TablePrincipal {
  id: string;
  campaignCode: string;
  role: 'owner' | 'dm';
}

export interface TableDescriptor {
  epoch: string;
  revision: number;
  writerFence: number;
  leaseUntil: number;
  holderSessionId: string | null;
  presentation: { sceneId: string | null; revision: number; blanked: boolean };
  publicRunId: string | null;
}

export interface TableResult {
  status: 'committed' | 'conflict' | 'denied' | 'unavailable';
  reason: string;
  current: TableDescriptor | null;
  historical?: boolean;
  committedRevision?: number;
}

export function tableControlKey(code: string): string {
  return `campaign:${code}:table-control`;
}
export function tableRegistryKey(code: string): string {
  return `campaign:${code}:table-scenes`;
}
export function tableLedgerKey(code: string): string {
  return `campaign:${code}:table-operations`;
}
export function tableLedgerOrderKey(code: string): string {
  return `campaign:${code}:table-operations-order`;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function decode<T>(value: T | string | null): T | null {
  if (!value) return null;
  return typeof value === 'string' ? (JSON.parse(value) as T) : value;
}

export function isTableProtocolRequired(): boolean {
  return process.env.TABLE_PROTOCOL_V1_REQUIRED === 'true';
}

export class TableControlService {
  constructor(
    private readonly redis: Pick<
      Redis,
      'eval' | 'get' | 'hgetall'
    > = getRawRedis()
  ) {}

  async read(code: string): Promise<TableDescriptor | null> {
    const state = decode<Record<string, unknown>>(
      await this.redis.get(tableControlKey(code))
    );
    if (!state || state.v !== 1) return null;
    const presentation = state.presentation as TableDescriptor['presentation'];
    return {
      epoch: state.epoch as string,
      revision: state.revision as number,
      writerFence: state.writerFence as number,
      leaseUntil: state.leaseUntil as number,
      holderSessionId: (state.holderSessionId ?? null) as string | null,
      presentation: {
        sceneId: presentation.sceneId ?? null,
        revision: presentation.revision,
        blanked: presentation.blanked,
      },
      publicRunId: (state.publicRunId ?? null) as string | null,
    };
  }

  async registry(
    principal: TablePrincipal
  ): Promise<Array<Record<string, unknown>>> {
    if (principal.role !== 'owner' && principal.role !== 'dm') return [];
    const entries = await this.redis.hgetall(
      tableRegistryKey(principal.campaignCode)
    );
    return Object.values(entries ?? {})
      .map(value => decode<Record<string, unknown>>(value as string)!)
      .filter(Boolean);
  }

  async execute(
    principal: TablePrincipal,
    command: TableCommand
  ): Promise<TableResult> {
    if (principal.role !== 'owner' && principal.role !== 'dm') {
      return { status: 'denied', reason: 'dm-required', current: null };
    }
    const code = principal.campaignCode;
    const digest = createHash('sha256')
      .update(canonical({ principal: principal.id, command }))
      .digest('hex');
    try {
      const response = await this.redis.eval(
        TABLE_CONTROL_SCRIPT,
        [
          tableControlKey(code),
          tableRegistryKey(code),
          tableLedgerKey(code),
          tableLedgerOrderKey(code),
          campaignSharedKey(code, 'initiative'),
          campaignSharedKey(code, 'battlemap'),
          campaignSharedKey(code, 'initiativeRequest'),
        ],
        [
          JSON.stringify(command),
          digest,
          principal.id,
          randomUUID(),
          randomUUID(),
        ]
      );
      return (
        decode<TableResult>(response as string) ?? {
          status: 'unavailable',
          reason: 'empty-result',
          current: null,
        }
      );
    } catch (error) {
      const reason =
        error instanceof Error && /CROSSSLOT/u.test(error.message)
          ? 'redis-cluster-cross-slot-unsupported'
          : 'redis-unavailable';
      return { status: 'unavailable', reason, current: null };
    }
  }
}
