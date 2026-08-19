import { NextRequest, NextResponse } from 'next/server';

import {
  createGuestSessionServiceForRequest,
  getHybridGuestServerConfig,
  validateGuestMutationRequest,
} from '@/lib/supabase/guestSessionServer';
import type { GuestRpcClient } from '@/lib/supabase/guestSessionGateway';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!getHybridGuestServerConfig()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const security = validateGuestMutationRequest(request);
  if (!security.ok) {
    return NextResponse.json({ error: security.error }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    mutationId?: string;
  } | null;
  if (!body?.mutationId) {
    return NextResponse.json(
      { error: 'mutationId is required' },
      { status: 400 }
    );
  }
  const context = await createGuestSessionServiceForRequest();
  if (!context?.userClient) {
    return NextResponse.json(
      { error: 'Authentication is required' },
      { status: 401 }
    );
  }
  const { id } = await params;
  const { data, error } = await (
    context.userClient as unknown as GuestRpcClient
  ).rpc('revoke_campaign_guest_invitation', {
    p_mutation_id: body.mutationId,
    p_invitation_id: id,
  });
  if (error) {
    return NextResponse.json({ error: 'Revocation denied' }, { status: 403 });
  }
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
