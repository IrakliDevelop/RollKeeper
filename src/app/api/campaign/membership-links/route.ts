import { NextRequest, NextResponse } from 'next/server';

import { CampaignMembershipService } from '@/lib/campaignMembershipService';
import { validateCampaignMembershipMutation } from '@/lib/campaignMembershipSecurity';
import { createCampaignMembershipContextForRequest } from '@/lib/supabase/campaignMembershipServer';

async function service() {
  const context = await createCampaignMembershipContextForRequest();
  return context?.userGateway
    ? new CampaignMembershipService({
        enabled: true,
        database: context.userGateway,
      })
    : null;
}

export async function GET() {
  const membership = await service();
  if (!membership)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    return NextResponse.json(await membership.listMine(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { error: 'Membership access was denied' },
      { status: 403 }
    );
  }
}

export async function POST(request: NextRequest) {
  const security = validateCampaignMembershipMutation(request);
  if (!security.ok)
    return NextResponse.json(
      { error: security.error },
      { status: security.status }
    );
  const body = (await request.json().catch(() => null)) as {
    mutationId?: string;
    campaignId?: string;
    characterId?: string;
    legacyPlayerId?: string | null;
    legacyCharacterId?: string | null;
    guestSubjectId?: string | null;
  } | null;
  if (!body?.mutationId || !body.campaignId || !body.characterId) {
    return NextResponse.json(
      { error: 'Explicit campaign and cloud character are required' },
      { status: 400 }
    );
  }
  const membership = await service();
  if (!membership)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    return NextResponse.json(
      await membership.linkCharacter({
        mutationId: body.mutationId,
        campaignId: body.campaignId,
        characterId: body.characterId,
        legacyPlayerId: body.legacyPlayerId ?? null,
        legacyCharacterId: body.legacyCharacterId ?? null,
        guestSubjectId: body.guestSubjectId ?? null,
      }),
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      { error: 'Character link was denied' },
      { status: 403 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const security = validateCampaignMembershipMutation(request);
  if (!security.ok)
    return NextResponse.json(
      { error: security.error },
      { status: security.status }
    );
  const body = (await request.json().catch(() => null)) as {
    mutationId?: string;
    campaignId?: string;
    characterId?: string;
  } | null;
  if (!body?.mutationId || !body.campaignId || !body.characterId) {
    return NextResponse.json(
      { error: 'Explicit campaign and cloud character are required' },
      { status: 400 }
    );
  }
  const membership = await service();
  if (!membership)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    return NextResponse.json(
      await membership.unlinkCharacter(body as Required<typeof body>),
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      { error: 'Character unlink was denied' },
      { status: 403 }
    );
  }
}
