import { isCombatLogArchiveServerEnabled } from '@/lib/durableDm/slice11fFlags';

import { createSupabaseServerClient } from './server';

export interface CombatLogArchiveRpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>
  ): Promise<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
}

export async function createCombatLogArchiveUserClient(): Promise<CombatLogArchiveRpcClient | null> {
  if (!isCombatLogArchiveServerEnabled()) return null;
  return (await createSupabaseServerClient()) as unknown as CombatLogArchiveRpcClient | null;
}

export async function callCombatLogArchiveRpc(
  client: CombatLogArchiveRpcClient,
  name: string,
  args: Record<string, unknown>
) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const wrapped = new Error(
      'Combat log archive request was rejected'
    ) as Error & {
      code?: string;
    };
    wrapped.code = error.code;
    throw wrapped;
  }
  return data;
}
