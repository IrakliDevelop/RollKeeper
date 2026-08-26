import { NextRequest, NextResponse } from 'next/server';

import { CampaignMembershipService } from '@/lib/campaignMembershipService';
import { validateCampaignMembershipMutation } from '@/lib/campaignMembershipSecurity';
import { createCampaignMembershipContextForRequest } from '@/lib/supabase/campaignMembershipServer';

function unavailable() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const security = validateCampaignMembershipMutation(request);
  if (!security.ok) {
    return NextResponse.json(
      { error: security.error },
      { status: security.status }
    );
  }
  const context = await createCampaignMembershipContextForRequest();
  if (!context?.userGateway) return unavailable();
  const body = (await request.json().catch(() => null)) as {
    campaignId?: string;
    invitedAccountId?: string;
    legacyPlayerId?: string | null;
    guestSubjectId?: string | null;
    expiresAt?: string;
    maxUses?: number;
    role?: 'dm' | 'player';
    mutationId?: string;
    tokenHash?: string;
  } | null;
  if (
    !body?.campaignId ||
    !body.invitedAccountId ||
    !body.mutationId ||
    !body.tokenHash ||
    typeof body.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(body.expiresAt)) ||
    Date.parse(body.expiresAt) < Date.now() + 60_000 ||
    Date.parse(body.expiresAt) > Date.now() + 7 * 24 * 60 * 60_000 ||
    !Number.isInteger(body.maxUses) ||
    (body.maxUses ?? 0) < 1 ||
    (body.maxUses ?? 0) > 5 ||
    (body.role !== 'dm' && body.role !== 'player')
  ) {
    return NextResponse.json(
      { error: 'Invalid membership invitation request' },
      { status: 400 }
    );
  }
  try {
    const service = new CampaignMembershipService({
      enabled: true,
      database: context.userGateway,
    });
    const result = await service.issue({
      mutationId: body.mutationId,
      tokenHash: body.tokenHash,
      campaignId: body.campaignId,
      invitedAccountId: body.invitedAccountId,
      legacyPlayerId: body.legacyPlayerId ?? null,
      guestSubjectId: body.guestSubjectId ?? null,
      expiresAt: body.expiresAt,
      maxUses: body.maxUses as number,
      role: body.role,
    });
    if (result.status !== 'issued') return unavailable();
    const response = NextResponse.json({
      invitation: result.invitation,
      acceptancePath: '/membership',
    });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  } catch {
    return NextResponse.json(
      { error: 'Membership invitation could not be issued' },
      { status: 403 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const security = validateCampaignMembershipMutation(request);
  if (!security.ok) {
    return NextResponse.json(
      { error: security.error },
      { status: security.status }
    );
  }
  const context = await createCampaignMembershipContextForRequest();
  if (!context?.userGateway) return unavailable();
  const body = (await request.json().catch(() => null)) as {
    mutationId?: string;
    invitationId?: string;
  } | null;
  if (!body?.mutationId || !body.invitationId) {
    return NextResponse.json(
      { error: 'Explicit invitation revocation is required' },
      { status: 400 }
    );
  }
  try {
    const service = new CampaignMembershipService({
      enabled: true,
      database: context.userGateway,
    });
    return NextResponse.json(
      await service.revoke({
        mutationId: body.mutationId,
        invitationId: body.invitationId,
      }),
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      { error: 'Membership invitation revocation was denied' },
      { status: 403 }
    );
  }
}
