import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/characters/[id] - Get specific character
export const GET = withAuth(async (request: NextRequest, { params, user }: { params: { id: string }, user: { userId: string } }) => {
  try {
    const characterId = params.id as string;

    const { data: character, error } = await supabaseAdmin
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .single();

    if (error || !character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }

    // Check access permissions
    const hasAccess = character.owner_user_id === user.userId || 
                     character.is_public ||
                     // TODO: Check if user is DM of character's campaign
                     false;

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({ character });

  } catch (error) {
    console.error('Character fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PUT /api/characters/[id] - Update character
export const PUT = withAuth(async (request: NextRequest, { params, user }: { params: { id: string }, user: { userId: string } }) => {
  try {
    const characterId = params.id as string;
    const body = await request.json();
    const { name, character_data, campaign_id, is_public, sync_status } = body;

    // Check if user owns the character
    const { data: character, error: fetchError } = await supabaseAdmin
      .from('characters')
      .select('owner_user_id, campaign_id')
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
        { error: 'Only the character owner can update this character' },
        { status: 403 }
      );
    }

    // Verify campaign access if changing campaign
    if (campaign_id && campaign_id !== character.campaign_id) {
      const { data: campaign, error: campaignError } = await supabaseAdmin
        .from('campaigns')
        .select(`
          id,
          dm_user_id,
          campaign_members!inner(user_id, is_active)
        `)
        .eq('id', campaign_id)
        .or(`dm_user_id.eq.${user.userId},campaign_members.user_id.eq.${user.userId}`)
        .eq('campaign_members.is_active', true)
        .single();

      if (campaignError || !campaign) {
        return NextResponse.json(
          { error: 'Campaign not found or access denied' },
          { status: 404 }
        );
      }
    }

    // Update character
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      last_synced: new Date().toISOString(),
    };

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Character name is required' },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (character_data !== undefined) {
      updateData.character_data = character_data;
    }

    if (campaign_id !== undefined) {
      updateData.campaign_id = campaign_id;
    }

    if (is_public !== undefined) {
      updateData.is_public = is_public;
    }

    if (sync_status !== undefined) {
      updateData.sync_status = sync_status;
    }

    const { data: updatedCharacter, error: updateError } = await supabaseAdmin
      .from('characters')
      .update(updateData)
      .eq('id', characterId)
      .select()
      .single();

    if (updateError) {
      console.error('Database error updating character:', updateError);
      return NextResponse.json(
        { error: 'Failed to update character' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      character: updatedCharacter,
      message: 'Character updated successfully' 
    });

  } catch (error) {
    console.error('Character update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/characters/[id] - Delete character
export const DELETE = withAuth(async (request: NextRequest, { params, user }: { params: { id: string }, user: { userId: string } }) => {
  try {
    const characterId = params.id as string;

    // Check if user owns the character
    const { data: character, error: fetchError } = await supabaseAdmin
      .from('characters')
      .select('owner_user_id')
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
        { error: 'Only the character owner can delete this character' },
        { status: 403 }
      );
    }

    // Delete character
    const { error: deleteError } = await supabaseAdmin
      .from('characters')
      .delete()
      .eq('id', characterId);

    if (deleteError) {
      console.error('Database error deleting character:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete character' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'Character deleted successfully' 
    });

  } catch (error) {
    console.error('Character deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
