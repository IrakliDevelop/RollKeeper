import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/campaigns/[id]/combat/end - End combat session
export const POST = withAuth(async (request: NextRequest, { params, user }: { params: { id: string }, user: { userId: string } }) => {
  try {
    const campaignId = params.id as string;

    // Verify user is DM of this campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('dm_user_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    if (campaign.dm_user_id !== user.userId) {
      return NextResponse.json(
        { error: 'Only the DM can end combat' },
        { status: 403 }
      );
    }

    // End any active realtime sessions for this campaign
    const { error: sessionError } = await supabaseAdmin
      .from('realtime_sessions')
      .update({ is_active: false })
      .eq('campaign_id', campaignId)
      .eq('session_type', 'combat')
      .eq('is_active', true);

    if (sessionError) {
      console.error('Error ending realtime sessions:', sessionError);
    }

    // Log the combat end event
    const { error: logError } = await supabaseAdmin
      .from('character_updates')
      .insert({
        character_id: 'system',
        campaign_id: campaignId,
        update_type: 'combat_end',
        update_data: {
          endedBy: user.userId,
          timestamp: new Date().toISOString(),
        },
        created_by: user.userId,
      });

    if (logError) {
      console.error('Error logging combat end:', logError);
    }

    return NextResponse.json({
      success: true,
      message: 'Combat ended successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Combat end error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
