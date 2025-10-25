import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { broadcastToCampaign } from '../connect/route';
import type { RealtimeEvent } from '@/lib/realtime';

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const { type, campaignId, characterId, data } = body;

    if (!type || !campaignId) {
      return NextResponse.json(
        { error: 'Type and campaignId are required' },
        { status: 400 }
      );
    }

    // Verify user has access to campaign
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('campaign_members')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.userId)
      .eq('is_active', true)
      .single();

    // Also check if user is the DM
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('dm_user_id')
      .eq('id', campaignId)
      .single();

    const isDM = campaign?.dm_user_id === user.userId;
    
    if (!membership && !isDM) {
      return NextResponse.json(
        { error: 'Access denied to campaign' },
        { status: 403 }
      );
    }

    // Create real-time event
    const event: RealtimeEvent = {
      type,
      campaignId,
      characterId,
      data,
      timestamp: Date.now(),
      userId: user.userId,
      username: user.username,
    };

    // Handle different event types
    switch (type) {
      case 'character_update':
        await handleCharacterUpdate(event, user.userId);
        break;
      case 'combat_update':
        await handleCombatUpdate(event, user.userId);
        break;
      case 'sync_request':
        // Just broadcast sync request, no database update needed
        break;
      case 'campaign_update':
        await handleCampaignUpdate(event, user.userId);
        break;
      default:
        // For unknown types, just broadcast without database update
        break;
    }

    // Broadcast to all connected clients in the campaign
    broadcastToCampaign(campaignId, event);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Real-time update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

async function handleCharacterUpdate(event: RealtimeEvent, userId: string) {
  if (!event.characterId) return;

  try {
    // Log the character update
    await supabaseAdmin
      .from('character_updates')
      .insert({
        character_id: event.characterId,
        campaign_id: event.campaignId,
        update_type: event.data.type || 'general_update',
        update_data: event.data,
        created_by: userId,
      });

    // Update character's last_synced timestamp
    await supabaseAdmin
      .from('characters')
      .update({ 
        last_synced: new Date().toISOString(),
        sync_status: 'synced',
        updated_at: new Date().toISOString()
      })
      .eq('id', event.characterId);

  } catch (error) {
    console.error('Error handling character update:', error);
  }
}

async function handleCombatUpdate(event: RealtimeEvent, userId: string) {
  if (!event.characterId) return;

  try {
    const combatData = event.data;
    
    // Log the combat update
    await supabaseAdmin
      .from('character_updates')
      .insert({
        character_id: event.characterId,
        campaign_id: event.campaignId,
        update_type: combatData.type || 'combat_action',
        update_data: combatData,
        created_by: userId,
      });

    // For certain combat updates, we might want to update the character data directly
    if (combatData.type === 'hp_change' && combatData.persistToCharacter) {
      // Update character's HP in the database
      const { data: character } = await supabaseAdmin
        .from('characters')
        .select('character_data')
        .eq('id', event.characterId)
        .single();

      if (character) {
        const updatedCharacterData = {
          ...character.character_data,
          hitPoints: {
            ...character.character_data.hitPoints,
            current: combatData.data.newHP,
          }
        };

        await supabaseAdmin
          .from('characters')
          .update({
            character_data: updatedCharacterData,
            last_synced: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', event.characterId);
      }
    }

  } catch (error) {
    console.error('Error handling combat update:', error);
  }
}

async function handleCampaignUpdate(event: RealtimeEvent, userId: string) {
  try {
    // Update campaign's updated_at timestamp
    await supabaseAdmin
      .from('campaigns')
      .update({ 
        updated_at: new Date().toISOString()
      })
      .eq('id', event.campaignId);

  } catch (error) {
    console.error('Error handling campaign update:', error);
  }
}
