import { createClient } from '@supabase/supabase-js';

import { isCalendarServerEnabled } from '@/lib/durableDm/slice11bFlags';
import type { Database } from '@/types/database.generated';

import { createSupabaseServerClient } from './server';

export interface CalendarRpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>
  ): Promise<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
}

export async function createCalendarUserClient(): Promise<CalendarRpcClient | null> {
  if (!isCalendarServerEnabled()) return null;
  return (await createSupabaseServerClient()) as unknown as CalendarRpcClient | null;
}

export function createCalendarApplicationClient(): CalendarRpcClient | null {
  if (!isCalendarServerEnabled()) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || Buffer.byteLength(key, 'utf8') < 32) return null;
  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  }) as unknown as CalendarRpcClient;
}

export async function callCalendarRpc(
  client: CalendarRpcClient,
  name: string,
  args: Record<string, unknown>
) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const wrapped = new Error('Calendar request was rejected') as Error & {
      code?: string;
    };
    wrapped.code = error.code;
    throw wrapped;
  }
  return data;
}

export async function calendarProjectionWriteAllowed(campaignCode: string) {
  if (!isCalendarServerEnabled()) return true;
  const client = createCalendarApplicationClient();
  if (!client) return false;
  try {
    const data = await callCalendarRpc(
      client,
      'resolve_calendar_projection_authority',
      { p_campaign_code: campaignCode }
    );
    return !(
      typeof data === 'object' &&
      data !== null &&
      'authority' in data &&
      data.authority === 'postgres'
    );
  } catch {
    return false;
  }
}
