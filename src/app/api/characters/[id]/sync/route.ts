import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/characters/[id]/sync - Sync character data
export const POST = withAuth(async (request: NextRequest, { params, user }: { params: { id: string }, user: { userId: string } }) => {
  try {
    const characterId = params.id as string;
    const body = await request.json();
    const { character_data, sync_type = 'manual', update_fields } = body;

    // Check if user owns the character
    const { data: character, error: fetchError } = await supabaseAdmin
      .from('characters')
      .select('owner_user_id, campaign_id, character_data')
      .eq('id', characterId)
      .single();

    if (fetchError || !character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }

    if (character.owner_user_id !== user.userId) {
      return NextResponse.json(
        { error: 'Only the character owner can sync this character' },
        { status: 403 }
      );
    }

    // Handle partial updates for real-time sync
    let updatedCharacterData = character_data;
    
    if (sync_type === 'partial' && update_fields && character.character_data) {
      // Merge specific fields for real-time updates
      updatedCharacterData = { ...character.character_data };
      
      for (const field of update_fields) {
        if (character_data[field] !== undefined) {
          updatedCharacterData[field] = character_data[field];
        }
      }
    }

    // Update character with sync information
    const { data: updatedCharacter, error: updateError } = await supabaseAdmin
      .from('characters')
      .update({
        character_data: updatedCharacterData,
        sync_status: 'synced',
        last_synced: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', characterId)
      .select()
      .single();

    if (updateError) {
      console.error('Database error syncing character:', updateError);
      return NextResponse.json(
        { error: 'Failed to sync character' },
        { status: 500 }
      );
    }

    // If character is in a campaign, create a real-time update event
    if (character.campaign_id) {
      const { error: eventError } = await supabaseAdmin
        .from('character_updates')
        .insert({
          character_id: characterId,
          campaign_id: character.campaign_id,
          update_type: sync_type,
          update_data: {
            sync_type,
            update_fields: update_fields || [],
            character_data: updatedCharacterData,
            timestamp: new Date().toISOString(),
          },
          created_by: user.userId,
        });

      if (eventError) {
        console.error('Error creating real-time event:', eventError);
        // Don't fail the sync if real-time event creation fails
      }
    }

    return NextResponse.json({ 
      character: updatedCharacter,
      message: 'Character synced successfully',
      sync_type,
      synced_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Character sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
