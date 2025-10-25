import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/characters - Get user's characters
export const GET = withAuth(async (request: NextRequest, { user }: { user: { userId: string } }) => {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');

    let query = supabaseAdmin
      .from('characters')
      .select('*')
      .eq('owner_user_id', user.userId)
      .order('updated_at', { ascending: false });

    // Filter by campaign if specified
    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    const { data: characters, error } = await query;

    if (error) {
      console.error('Database error fetching characters:', error);
      return NextResponse.json(
        { error: 'Failed to fetch characters' },
        { status: 500 }
      );
    }

    return NextResponse.json({ characters: characters || [] });

  } catch (error) {
    console.error('Characters fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/characters - Create new character
export const POST = withAuth(async (request: NextRequest, { user }: { user: { userId: string } }) => {
  try {
    const body = await request.json();
    const { name, character_data, campaign_id, is_public = false } = body;

    // Validate input
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Character name is required' },
        { status: 400 }
      );
    }

    if (!character_data) {
      return NextResponse.json(
        { error: 'Character data is required' },
        { status: 400 }
      );
    }

    if (name.length > 200) {
      return NextResponse.json(
        { error: 'Character name must be 200 characters or less' },
        { status: 400 }
      );
    }

    // Verify campaign access if campaign_id is provided
    if (campaign_id) {
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

    // Create character
    const { data: character, error: createError } = await supabaseAdmin
      .from('characters')
      .insert({
        name: name.trim(),
        owner_user_id: user.userId,
        campaign_id: campaign_id || null,
        character_data,
        is_public,
        sync_status: 'synced',
        last_synced: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error('Database error creating character:', createError);
      return NextResponse.json(
        { error: 'Failed to create character' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      character,
      message: 'Character created successfully' 
    });

  } catch (error) {
    console.error('Character creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
