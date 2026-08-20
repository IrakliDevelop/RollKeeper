import { NextRequest, NextResponse } from 'next/server';

import { CampaignMembershipService } from '@/lib/campaignMembershipService';
import { validateCampaignMembershipMutation } from '@/lib/campaignMembershipSecurity';
import { createCampaignMembershipContextForRequest } from '@/lib/supabase/campaignMembershipServer';

export async function POST(request: NextRequest) {
  const security = validateCampaignMembershipMutation(request);
  if (!security.ok)
    return NextResponse.json(
      { error: security.error },
      { status: security.status }
    );
  const context = await createCampaignMembershipContextForRequest();
  if (!context?.userGateway)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await request.json().catch(() => null)) as {
    invitationToken?: string;
    mutationId?: string;
    decision?: 'accepted' | 'refused';
  } | null;
  if (
    !body?.invitationToken ||
    !body.mutationId ||
    (body.decision !== 'accepted' && body.decision !== 'refused')
  ) {
    return NextResponse.json(
      { error: 'Invitation and explicit decision are required' },
      { status: 400 }
    );
  }
  try {
    const service = new CampaignMembershipService({
      enabled: true,
      database: context.userGateway,
    });
    const result = await service.respond({
      invitationToken: body.invitationToken,
      mutationId: body.mutationId,
      decision: body.decision,
    });
    if (
      typeof result === 'object' &&
      result !== null &&
      'status' in result &&
      result.status === 'denied'
    ) {
      return NextResponse.json(
        { error: 'Membership invitation is invalid or unavailable' },
        { status: 401 }
      );
    }
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Membership invitation is invalid or unavailable' },
      { status: 401 }
    );
  }
}
