import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// PATCH /api/campaigns/[id]/combat/participants/[participantId] - Update combat participant
export const PATCH = withAuth(async (request: NextRequest, { params, user }: { params: { id: string, participantId: string }, user: { userId: string } }) => {
  try {
    const campaignId = params.id as string;
    const participantId = params.participantId as string;
    const updates = await request.json();

    // Verify user has access to this campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select(`
        *,
        campaign_members!inner(user_id, is_active)
      `)
      .eq('id', campaignId)
      .or(`dm_user_id.eq.${user.userId},campaign_members.user_id.eq.${user.userId}`)
      .eq('campaign_members.is_active', true)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found or access denied' },
        { status: 404 }
      );
    }

    // Check if user is DM or if they're updating their own character
    const isDM = campaign.dm_user_id === user.userId;
    
    if (!isDM) {
      // For players, verify they own the character being updated
      const { data: character, error: characterError } = await supabaseAdmin
        .from('characters')
        .select('owner_user_id')
        .eq('id', updates.characterId || '')
        .single();

      if (characterError || !character || character.owner_user_id !== user.userId) {
        return NextResponse.json(
          { error: 'You can only update your own character' },
          { status: 403 }
        );
      }
    }

    // Store the combat update in the database
    const { error: updateError } = await supabaseAdmin
      .from('character_updates')
      .insert({
        character_id: updates.characterId || participantId,
        campaign_id: campaignId,
        update_type: 'combat_update',
        update_data: {
          participantId,
          updates,
          timestamp: new Date().toISOString(),
        },
        created_by: user.userId,
      });

    if (updateError) {
      console.error('Database error storing combat update:', updateError);
      return NextResponse.json(
        { error: 'Failed to store combat update' },
        { status: 500 }
      );
    }

    // In a real implementation, you would broadcast this update to all connected clients
    // For now, we'll just return success
    // TODO: Implement real-time broadcasting using WebSockets or SSE

    return NextResponse.json({
      success: true,
      participantId,
      updates,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Combat participant update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
