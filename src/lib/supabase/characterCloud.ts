import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.generated';

import { isAuthEnabled } from './authConfig';
import { createSupabaseBrowserClient } from './browser';
import { createSupabaseCharacterCloudGateway } from './characterCloudGateway';
import { createCharacterCloudLinkRepository } from './characterCloudLinks';
import {
  type CharacterCloudAccount,
  ManualCharacterCloudService,
} from './manualCharacterCloudService';

interface AuthUserResult {
  data: {
    user: { id: string; email?: string } | null;
  };
  error: { message: string } | null;
}

export interface ManualCharacterCloudContext {
  service: ManualCharacterCloudService;
  getAccount(): Promise<CharacterCloudAccount>;
}

export function isManualCharacterCloudEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED === 'true' &&
    isAuthEnabled()
  );
}

export function createManualCharacterCloud(
  storage: Pick<Storage, 'getItem' | 'setItem'>
): ManualCharacterCloudContext | null {
  if (!isManualCharacterCloudEnabled()) return null;
  const client = createSupabaseBrowserClient();
  if (!client) return null;

  const service = new ManualCharacterCloudService(
    createSupabaseCharacterCloudGateway(
      client as unknown as Parameters<
        typeof createSupabaseCharacterCloudGateway
      >[0]
    ),
    createCharacterCloudLinkRepository(storage)
  );

  return {
    service,
    async getAccount() {
      const auth = (client as SupabaseClient<Database>).auth as unknown as {
        getUser(): Promise<AuthUserResult>;
      };
      const { data, error } = await auth.getUser();
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error('Sign in before using cloud backup');
      return { id: data.user.id, email: data.user.email };
    },
  };
}
