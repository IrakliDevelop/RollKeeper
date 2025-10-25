import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/campaigns/[id] - Get specific campaign
export const GET = withAuth(async (request: NextRequest, { params, user }: { params: { id: string }, user: { userId: string } }) => {
  try {
    const campaignId = params.id as string;

    // Get campaign with member info
    const { data: campaign, error } = await supabaseAdmin
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
      .eq('id', campaignId)
      .single();

    if (error || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Check if user has access (is DM or member)
    const isDM = campaign.dm_user_id === user.userId;
    const isMember = campaign.campaign_members?.some(
      (member: { user_id: string; is_active: boolean }) => member.user_id === user.userId && member.is_active
    );

    if (!isDM && !isMember) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({ campaign });

  } catch (error) {
    console.error('Campaign fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PUT /api/campaigns/[id] - Update campaign
export const PUT = withAuth(async (request: NextRequest, { params, user }: { params: { id: string }, user: { userId: string } }) => {
  try {
    const campaignId = params.id as string;
    const body = await request.json();
    const { name, description, settings, is_active } = body;

    // Check if user is DM
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('campaigns')
      .select('dm_user_id')
      .eq('id', campaignId)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    if (campaign.dm_user_id !== user.userId) {
      return NextResponse.json(
        { error: 'Only the DM can update campaign settings' },
        { status: 403 }
      );
    }

    // Update campaign
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Campaign name is required' },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (settings !== undefined) {
      updateData.settings = settings;
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    const { data: updatedCampaign, error: updateError } = await supabaseAdmin
      .from('campaigns')
      .update(updateData)
      .eq('id', campaignId)
      .select()
      .single();

    if (updateError) {
      console.error('Database error updating campaign:', updateError);
      return NextResponse.json(
        { error: 'Failed to update campaign' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      campaign: updatedCampaign,
      message: 'Campaign updated successfully' 
    });

  } catch (error) {
    console.error('Campaign update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/campaigns/[id] - Delete campaign
export const DELETE = withAuth(async (request: NextRequest, { params, user }: { params: { id: string }, user: { userId: string } }) => {
  try {
    const campaignId = params.id as string;

    // Check if user is DM
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('campaigns')
      .select('dm_user_id')
      .eq('id', campaignId)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    if (campaign.dm_user_id !== user.userId) {
      return NextResponse.json(
        { error: 'Only the DM can delete the campaign' },
        { status: 403 }
      );
    }

    // Delete campaign (cascade will handle members, sessions, etc.)
    const { error: deleteError } = await supabaseAdmin
      .from('campaigns')
      .delete()
      .eq('id', campaignId);

    if (deleteError) {
      console.error('Database error deleting campaign:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete campaign' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'Campaign deleted successfully' 
    });

  } catch (error) {
    console.error('Campaign deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
