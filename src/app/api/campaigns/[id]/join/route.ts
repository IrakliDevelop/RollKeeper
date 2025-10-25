import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/campaigns/[id]/join - Join campaign with invite code
export const POST = withAuth(async (request: NextRequest, { params, user }: { params: Promise<{ id: string }>, user: { userId: string } }) => {
  try {
    const resolvedParams = await params;
    const campaignId = resolvedParams.id as string;
    const body = await request.json();
    const { inviteCode, characterId } = body;

    console.log('Join campaign request:', { campaignId, inviteCode, characterId, userId: user.userId });

    // Get campaign by invite code (ignore campaignId from URL if it's 'temp')
    let campaign;
    let campaignError;

    if (campaignId === 'temp') {
      // Find campaign by invite code
      const result = await supabaseAdmin
        .from('campaigns')
        .select('*')
        .eq('invite_code', inviteCode)
        .eq('is_active', true)
        .single();
      
      campaign = result.data;
      campaignError = result.error;
    } else {
      // Verify specific campaign with invite code
      const result = await supabaseAdmin
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('invite_code', inviteCode)
        .eq('is_active', true)
        .single();
      
      campaign = result.data;
      campaignError = result.error;
    }

    if (campaignError || !campaign) {
      console.log('Campaign lookup failed:', { campaignError, campaign, inviteCode });
      return NextResponse.json(
        { error: 'Invalid invite code or campaign not found' },
        { status: 404 }
      );
    }

    console.log('Found campaign:', { campaignId: campaign.id, campaignName: campaign.name });

    // Use the actual campaign ID from the found campaign
    const actualCampaignId = campaign.id;

    // Check if user is already a member
    const { data: existingMember } = await supabaseAdmin
      .from('campaign_members')
      .select('*')
      .eq('campaign_id', actualCampaignId)
      .eq('user_id', user.userId)
      .single();

    if (existingMember) {
      if (existingMember.is_active) {
        return NextResponse.json(
          { error: 'You are already a member of this campaign' },
          { status: 409 }
        );
      } else {
        // Reactivate membership
        const { data: reactivatedMember, error: reactivateError } = await supabaseAdmin
          .from('campaign_members')
          .update({ 
            is_active: true,
            character_id: characterId || null,
            joined_at: new Date().toISOString()
          })
          .eq('id', existingMember.id)
          .select()
          .single();

        if (reactivateError) {
          console.error('Database error reactivating membership:', reactivateError);
          return NextResponse.json(
            { error: 'Failed to rejoin campaign' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          membership: reactivatedMember,
          campaign,
          message: 'Successfully rejoined campaign'
        });
      }
    }

    // Verify character belongs to user (if provided)
    if (characterId && characterId.trim() !== '') {
      console.log('Validating character:', characterId);
      const { data: character, error: characterError } = await supabaseAdmin
        .from('characters')
        .select('owner_user_id')
        .eq('id', characterId)
        .single();

      console.log('Character validation result:', { character, characterError });

      if (characterError || !character || character.owner_user_id !== user.userId) {
        return NextResponse.json(
          { error: 'Character not found or access denied' },
          { status: 404 }
        );
      }
    }

    // Create new membership
    const { data: newMember, error: createError } = await supabaseAdmin
      .from('campaign_members')
      .insert({
        campaign_id: actualCampaignId,
        user_id: user.userId,
        character_id: characterId || null,
        role: 'player',
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      console.error('Database error creating membership:', createError);
      return NextResponse.json(
        { error: 'Failed to join campaign' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      membership: newMember,
      campaign,
      message: 'Successfully joined campaign'
    });

  } catch (error) {
    console.error('Campaign join error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/campaigns/[id]/join - Leave campaign
export const DELETE = withAuth(async (request: NextRequest, { params, user }: { params: Promise<{ id: string }>, user: { userId: string } }) => {
  try {
    const resolvedParams = await params;
    const campaignId = resolvedParams.id as string;

    // Check if user is a member
    const { data: membership, error: memberError } = await supabaseAdmin
      .from('campaign_members')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.userId)
      .eq('is_active', true)
      .single();

    if (memberError || !membership) {
      return NextResponse.json(
        { error: 'You are not a member of this campaign' },
        { status: 404 }
      );
    }

    // Check if user is the DM (DMs can't leave their own campaigns)
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('dm_user_id')
      .eq('id', campaignId)
      .single();

    if (campaign && campaign.dm_user_id === user.userId) {
      return NextResponse.json(
        { error: 'Campaign DMs cannot leave their own campaigns. Delete the campaign instead.' },
        { status: 400 }
      );
    }

    // Deactivate membership (soft delete)
    const { error: leaveError } = await supabaseAdmin
      .from('campaign_members')
      .update({ is_active: false })
      .eq('id', membership.id);

    if (leaveError) {
      console.error('Database error leaving campaign:', leaveError);
      return NextResponse.json(
        { error: 'Failed to leave campaign' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Successfully left campaign'
    });

  } catch (error) {
    console.error('Campaign leave error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
