import { isEncounterServerEnabled } from '@/lib/durableDm/slice11eFlags';

import { createSupabaseServerClient } from './server';

export interface EncounterRpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>
  ): Promise<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
}

export async function createEncounterUserClient(): Promise<EncounterRpcClient | null> {
  if (!isEncounterServerEnabled()) return null;
  return (await createSupabaseServerClient()) as unknown as EncounterRpcClient | null;
}

export async function callEncounterRpc(
  client: EncounterRpcClient,
  name: string,
  args: Record<string, unknown>
) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const wrapped = new Error('Encounter request was rejected') as Error & {
      code?: string;
    };
    wrapped.code = error.code;
    throw wrapped;
  }
  return data;
}
