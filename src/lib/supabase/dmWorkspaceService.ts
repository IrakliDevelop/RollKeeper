import type {
  DmWorkspaceAcknowledgement,
  DmWorkspaceCreateIntent,
  DmWorkspaceWorkState,
} from '@/lib/indexeddb/dmWorkspaceRepository';

import { isAuthEnabled } from './authConfig';

export interface DmWorkspaceCreateRequest {
  mutationId: string;
  name: string;
  creationKind: 'new_workspace' | 'import_fork';
  sourceFingerprint: string | null;
}

export interface DmWorkspaceGateway {
  create(
    request: DmWorkspaceCreateRequest
  ): Promise<DmWorkspaceAcknowledgement>;
}

interface DmWorkspaceRepositoryPort {
  commitCreate(
    intent: DmWorkspaceCreateIntent
  ): Promise<
    | { saved: true; mutationId: string }
    | { saved: false; reason: 'guest' | 'failed' }
  >;
  acknowledge(
    mutationId: string,
    acknowledgement: DmWorkspaceAcknowledgement
  ): Promise<void>;
  updateWork(
    mutationId: string,
    updates: { state: DmWorkspaceWorkState; lastError: string | null }
  ): Promise<void>;
}

interface DmWorkspaceServiceOptions {
  enabled: boolean;
  accountId: string;
  repository: DmWorkspaceRepositoryPort;
  gateway: DmWorkspaceGateway;
  now?: () => Date;
}

export type DmWorkspaceCreateResult =
  | { status: 'disabled' }
  | { status: 'local-failed' }
  | { status: 'created'; workspace: DmWorkspaceAcknowledgement }
  | {
      status: 'queued';
      reason: 'offline' | 'auth-required' | 'failed';
    };

function cloudFailure(error: unknown): {
  reason: 'offline' | 'auth-required' | 'failed';
  message: string;
} {
  const category =
    typeof error === 'object' &&
    error !== null &&
    'category' in error &&
    (error.category === 'offline' || error.category === 'auth-required')
      ? error.category
      : 'failed';
  return {
    reason: category,
    message: error instanceof Error ? error.message : 'Cloud request failed',
  };
}

export function isDmWorkspaceCloudEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_DM_WORKSPACE_ENABLED === 'true' &&
    isAuthEnabled()
  );
}

export class DmWorkspaceService {
  private readonly now: () => Date;

  constructor(private readonly options: DmWorkspaceServiceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  create(input: {
    localId: string;
    name: string;
  }): Promise<DmWorkspaceCreateResult> {
    return this.commit({
      ...input,
      creationKind: 'new_workspace',
      sourceFingerprint: null,
    });
  }

  fork(input: {
    localId: string;
    name: string;
    sourceFingerprint: string;
  }): Promise<DmWorkspaceCreateResult> {
    return this.commit({ ...input, creationKind: 'import_fork' });
  }

  private async commit(input: {
    localId: string;
    name: string;
    creationKind: 'new_workspace' | 'import_fork';
    sourceFingerprint: string | null;
  }): Promise<DmWorkspaceCreateResult> {
    if (!this.options.enabled) return { status: 'disabled' };
    const local = await this.options.repository.commitCreate({
      namespace: `user:${this.options.accountId}`,
      localId: input.localId,
      name: input.name,
      creationKind: input.creationKind,
      sourceFingerprint: input.sourceFingerprint,
      createdAt: this.now().toISOString(),
    });
    if (!local.saved) return { status: 'local-failed' };

    try {
      const workspace = await this.options.gateway.create({
        mutationId: local.mutationId,
        name: input.name,
        creationKind: input.creationKind,
        sourceFingerprint: input.sourceFingerprint,
      });
      await this.options.repository.acknowledge(local.mutationId, workspace);
      return { status: 'created', workspace };
    } catch (error) {
      const failure = cloudFailure(error);
      await this.options.repository.updateWork(local.mutationId, {
        state: failure.reason,
        lastError: failure.message,
      });
      return { status: 'queued', reason: failure.reason };
    }
  }
}
