import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';

// GET /api/campaigns/[id]/combat/connect - Establish SSE connection for combat
export const GET = withAuth(async (request: NextRequest, { params, user }: { params: { id: string }, user: { userId: string } }) => {
  try {
    const campaignId = params.id as string;

    // Verify user has access to this campaign
    const { supabaseAdmin } = await import('@/lib/supabase');
    
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
      return new NextResponse('Campaign not found or access denied', { status: 404 });
    }

    // Set up Server-Sent Events
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection confirmation
        const data = encoder.encode(`data: ${JSON.stringify({
          type: 'connected',
          campaignId,
          userId: user.userId,
          timestamp: new Date().toISOString(),
        })}\n\n`);
        controller.enqueue(data);

        // Set up periodic heartbeat
        const heartbeat = setInterval(() => {
          try {
            const heartbeatData = encoder.encode(`data: ${JSON.stringify({
              type: 'heartbeat',
              timestamp: new Date().toISOString(),
            })}\n\n`);
            controller.enqueue(heartbeatData);
          } catch (error) {
            console.error('Heartbeat error:', error);
            clearInterval(heartbeat);
          }
        }, 30000); // 30 second heartbeat

        // Store connection info (in a real app, you'd use Redis or similar)
        // For now, we'll use a simple in-memory store
        const connectionId = `${campaignId}-${user.userId}-${Date.now()}`;
        
        // Clean up on close
        const cleanup = () => {
          clearInterval(heartbeat);
          // Remove from connection store
          console.log(`Combat connection closed: ${connectionId}`);
        };

        // Handle client disconnect
        request.signal.addEventListener('abort', cleanup);
        
        // Store cleanup function for later use
        (controller as any).cleanup = cleanup;
      },
      
      cancel() {
        // Cleanup when stream is cancelled
        if ((this as any).cleanup) {
          (this as any).cleanup();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error) {
    console.error('Combat SSE connection error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
});
