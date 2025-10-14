import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// DELETE /api/campaigns/[id]/members/[memberId] - Remove member from campaign (DM only)
export const DELETE = withAuth(async (request: NextRequest, { params, user }: { params: Promise<{ id: string; memberId: string }>, user: { userId: string } }) => {
  try {
    const resolvedParams = await params;
    const campaignId = resolvedParams.id as string;
    const memberId = resolvedParams.memberId as string;

    console.log('Remove member request:', { campaignId, memberId, dmUserId: user.userId });

    // First, verify that the requesting user is the DM of this campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('dm_user_id, name')
      .eq('id', campaignId)
      .eq('is_active', true)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    if (campaign.dm_user_id !== user.userId) {
      return NextResponse.json(
        { error: 'Only the campaign DM can remove members' },
        { status: 403 }
      );
    }

    // Get the member to be removed
    const { data: member, error: memberError } = await supabaseAdmin
      .from('campaign_members')
      .select(`
        id,
        user_id,
        role,
        is_active,
        users(username, display_name)
      `)
      .eq('id', memberId)
      .eq('campaign_id', campaignId)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Member not found in this campaign' },
        { status: 404 }
      );
    }

    // Prevent DM from removing themselves
    if (member.user_id === user.userId) {
      return NextResponse.json(
        { error: 'Campaign DMs cannot remove themselves. Delete the campaign instead.' },
        { status: 400 }
      );
    }

    // Deactivate the membership (soft delete)
    const { error: removeError } = await supabaseAdmin
      .from('campaign_members')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId);

    if (removeError) {
      console.error('Database error removing member:', removeError);
      return NextResponse.json(
        { error: 'Failed to remove member from campaign' },
        { status: 500 }
      );
    }

    const memberName = (member.users as { display_name?: string; username?: string })?.display_name || 
                       (member.users as { display_name?: string; username?: string })?.username || 
                       'Unknown User';

    return NextResponse.json({
      message: `Successfully removed ${memberName} from campaign`,
      removedMember: {
        id: member.id,
        user_id: member.user_id,
        name: memberName,
      }
    });

  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
