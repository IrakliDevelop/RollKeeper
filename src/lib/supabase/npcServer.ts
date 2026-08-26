import { isNpcServerEnabled } from '@/lib/durableDm/slice11dFlags';

import { createSupabaseServerClient } from './server';

export interface NpcRpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>
  ): Promise<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
}

export async function createNpcUserClient(): Promise<NpcRpcClient | null> {
  if (!isNpcServerEnabled()) return null;
  return (await createSupabaseServerClient()) as unknown as NpcRpcClient | null;
}

export async function callNpcRpc(
  client: NpcRpcClient,
  name: string,
  args: Record<string, unknown>
) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const wrapped = new Error('NPC request was rejected') as Error & {
      code?: string;
    };
    wrapped.code = error.code;
    throw wrapped;
  }
  return data;
}
