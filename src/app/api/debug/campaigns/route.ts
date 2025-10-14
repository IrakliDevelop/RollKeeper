import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/debug/campaigns - Debug campaign data
export const GET = withAuth(async (request: NextRequest, { user }: { user: { userId: string } }) => {
  try {
    // Get all campaigns for this user
    const { data: campaigns, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('dm_user_id', user.userId);

    if (error) {
      console.error('Debug campaigns error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      userId: user.userId,
      campaigns: campaigns || [],
      totalCampaigns: campaigns?.length || 0,
    });

  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/debug/campaigns - Test campaign lookup by invite code
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { inviteCode } = body;

    if (!inviteCode) {
      return NextResponse.json({ error: 'Invite code required' }, { status: 400 });
    }

    // Test campaign lookup
    const { data: campaign, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .eq('is_active', true)
      .single();

    return NextResponse.json({
      inviteCode: inviteCode.toUpperCase(),
      found: !!campaign,
      campaign: campaign || null,
      error: error || null,
    });

  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
