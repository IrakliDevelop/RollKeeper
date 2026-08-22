import { isMagicItemServerEnabled } from '@/lib/durableDm/slice11cFlags';

import { createSupabaseServerClient } from './server';

export interface MagicItemRpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>
  ): Promise<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
}

export async function createMagicItemUserClient(): Promise<MagicItemRpcClient | null> {
  if (!isMagicItemServerEnabled()) return null;
  return (await createSupabaseServerClient()) as unknown as MagicItemRpcClient | null;
}

export async function callMagicItemRpc(
  client: MagicItemRpcClient,
  name: string,
  args: Record<string, unknown>
) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const wrapped = new Error('Magic item request was rejected') as Error & {
      code?: string;
    };
    wrapped.code = error.code;
    throw wrapped;
  }
  return data;
}
