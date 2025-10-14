import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/campaigns - Get user's campaigns
export const GET = withAuth(async (request: NextRequest, { user }: { user: { userId: string } }) => {
  try {
    // Get campaigns where user is DM
    const { data: dmCampaigns, error: dmError } = await supabaseAdmin
      .from('campaigns')
      .select(`
        *,
        campaign_members(
          id,
          user_id,
          character_id,
          role,
          joined_at,
          is_active,
          users(
            id,
            username,
            display_name,
            is_dm
          ),
          characters(
            id,
            name,
            character_data
          )
        )
      `)
      .eq('dm_user_id', user.userId)
      .order('updated_at', { ascending: false });

    if (dmError) {
      console.error('Database error fetching DM campaigns:', dmError);
      return NextResponse.json(
        { error: 'Failed to fetch DM campaigns' },
        { status: 500 }
      );
    }

    // Get campaigns where user is a member
    const { data: memberCampaigns, error: memberError } = await supabaseAdmin
      .from('campaigns')
      .select(`
        *,
        campaign_members!inner(
          id,
          user_id,
          character_id,
          role,
          joined_at,
          is_active,
          users(
            id,
            username,
            display_name,
            is_dm
          ),
          characters(
            id,
            name,
            character_data
          )
        )
      `)
      .eq('campaign_members.user_id', user.userId)
      .eq('campaign_members.is_active', true)
      .order('updated_at', { ascending: false });

    if (memberError) {
      console.error('Database error fetching member campaigns:', memberError);
      return NextResponse.json(
        { error: 'Failed to fetch member campaigns' },
        { status: 500 }
      );
    }

    // Combine and deduplicate campaigns
    const allCampaigns = [...(dmCampaigns || []), ...(memberCampaigns || [])];
    const uniqueCampaigns = allCampaigns.filter(
      (campaign, index, self) => 
        index === self.findIndex(c => c.id === campaign.id)
    );

    return NextResponse.json({ campaigns: uniqueCampaigns });

  } catch (error) {
    console.error('Campaigns fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/campaigns - Create new campaign
export const POST = withAuth(async (request: NextRequest, { user }: { user: { userId: string } }) => {
  try {
    const body = await request.json();
    const { name, description, settings } = body;

    // Validate input
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Campaign name is required' },
        { status: 400 }
      );
    }

    if (name.length > 200) {
      return NextResponse.json(
        { error: 'Campaign name must be 200 characters or less' },
        { status: 400 }
      );
    }

    // Generate invite code
    const generateInviteCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    // Create campaign
    const { data: campaign, error: createError } = await supabaseAdmin
      .from('campaigns')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        dm_user_id: user.userId,
        settings: settings || {},
        is_active: true,
        invite_code: generateInviteCode(),
      })
      .select()
      .single();

    if (createError) {
      console.error('Database error creating campaign:', createError);
      return NextResponse.json(
        { error: 'Failed to create campaign' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      campaign,
      message: 'Campaign created successfully' 
    });

  } catch (error) {
    console.error('Campaign creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
