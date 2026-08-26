import { createHmac } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

import { GuestSessionService } from '@/lib/guestSessionService';
import {
  resolveHybridGuestRequest,
  type HybridGuestResolution,
} from '@/lib/guestRouteAuthorization';
import {
  isHybridGuestServerEnabled,
  validateGuestMutationRequest,
} from '@/lib/guestSessionSecurity';
import type { Database } from '@/types/database.generated';

import {
  createGuestApplicationGateway,
  createGuestOwnerGateway,
  type GuestRpcClient,
} from './guestSessionGateway';
import { createSupabaseServerClient } from './server';

const MIN_SECRET_BYTES = 32;

function requiredSecret(value: string | undefined): string | null {
  return value && Buffer.byteLength(value, 'utf8') >= MIN_SECRET_BYTES
    ? value
    : null;
}

export function getHybridGuestServerConfig() {
  if (!isHybridGuestServerEnabled()) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = requiredSecret(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const pepper = requiredSecret(process.env.GUEST_SESSION_PEPPER);
  if (!url || !serviceRoleKey || !pepper) return null;
  return { url, serviceRoleKey, pepper };
}

function applicationRpcClient(
  url: string,
  serviceRoleKey: string
): GuestRpcClient {
  const admin = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  return admin as unknown as GuestRpcClient;
}

export async function createGuestSessionServiceForRequest() {
  const config = getHybridGuestServerConfig();
  if (!config) return null;
  const appGateway = createGuestApplicationGateway(
    applicationRpcClient(config.url, config.serviceRoleKey)
  );
  const userClient = await createSupabaseServerClient();
  const ownerGateway = userClient
    ? createGuestOwnerGateway(userClient as unknown as GuestRpcClient)
    : null;
  return {
    service: new GuestSessionService({
      enabled: true,
      database: {
        ...appGateway,
        issue(input) {
          if (!ownerGateway) {
            return Promise.reject(new Error('Authentication is required'));
          }
          return ownerGateway.issue(input);
        },
      },
      pepper: config.pepper,
    }),
    userClient,
    pepper: config.pepper,
  };
}

export function guestRequestRateKey(
  request: NextRequest,
  pepper: string
): string {
  const forwarded =
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('x-forwarded-for') ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const address = forwarded.split(',')[0]?.trim() || 'unknown';
  const agent = request.headers.get('user-agent') ?? 'unknown';
  return createHmac('sha256', pepper)
    .update('rollkeeper-guest-rate-v1\0', 'utf8')
    .update(address, 'utf8')
    .update('\0', 'utf8')
    .update(agent.slice(0, 256), 'utf8')
    .digest('hex');
}

export async function authorizeHybridGuestRoute(
  request: NextRequest,
  displayCode: string,
  requiredScope: string,
  mutation = false
): Promise<HybridGuestResolution> {
  if (!isHybridGuestServerEnabled()) return { mode: 'legacy' };
  const context = await createGuestSessionServiceForRequest();
  if (!context) {
    return { mode: 'denied', status: 403, clearCookie: false };
  }
  const rateKey = guestRequestRateKey(request, context.pepper);
  return resolveHybridGuestRequest(request, {
    enabled: true,
    displayCode,
    requiredScope,
    mutation,
    authorize: input => context.service.authorize(input),
    recordInvalid: () => context.service.recordInvalid(rateKey),
  });
}

export { validateGuestMutationRequest };
