import { NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Store active connections
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaignId');
  const token = searchParams.get('token');

  if (!campaignId || !token) {
    return new Response('Missing campaignId or token', { status: 400 });
  }

  // Verify authentication
  const payload = verifyAccessToken(token);
  if (!payload) {
    return new Response('Invalid or expired token', { status: 401 });
  }

  // Verify user has access to campaign
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('campaign_members')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('user_id', payload.userId)
    .eq('is_active', true)
    .single();

  // Also check if user is the DM
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('campaigns')
    .select('dm_user_id')
    .eq('id', campaignId)
    .single();

  const isDM = campaign?.dm_user_id === payload.userId;
  
  if (!membership && !isDM) {
    return new Response('Access denied to campaign', { status: 403 });
  }

  // Create Server-Sent Events stream
  const stream = new ReadableStream({
    start(controller) {
      // Add connection to the campaign's connection set
      if (!connections.has(campaignId)) {
        connections.set(campaignId, new Set());
      }
      connections.get(campaignId)!.add(controller);

      // Send initial connection confirmation
      const welcomeEvent = {
        type: 'connection_established',
        campaignId,
        data: {
          userId: payload.userId,
          username: payload.username,
          isDM,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
        userId: payload.userId,
      };

      controller.enqueue(`data: ${JSON.stringify(welcomeEvent)}\n\n`);

      // Notify other users that someone joined
      const joinEvent = {
        type: 'user_joined',
        campaignId,
        data: {
          userId: payload.userId,
          username: payload.username,
          isDM,
        },
        timestamp: Date.now(),
        userId: payload.userId,
      };

      // Broadcast to other connections in the same campaign
      broadcastToCampaign(campaignId, joinEvent, controller);

      // Set up heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
        } catch (error) {
          // Connection closed, clean up
          clearInterval(heartbeatInterval);
          cleanup();
        }
      }, 30000); // Send heartbeat every 30 seconds

      // Cleanup function
      const cleanup = () => {
        clearInterval(heartbeatInterval);
        
        // Remove connection from campaign set
        const campaignConnections = connections.get(campaignId);
        if (campaignConnections) {
          campaignConnections.delete(controller);
          
          // If no more connections for this campaign, remove the set
          if (campaignConnections.size === 0) {
            connections.delete(campaignId);
          } else {
            // Notify remaining users that someone left
            const leaveEvent = {
              type: 'user_left',
              campaignId,
              data: {
                userId: payload.userId,
                username: payload.username,
              },
              timestamp: Date.now(),
              userId: payload.userId,
            };
            broadcastToCampaign(campaignId, leaveEvent);
          }
        }
      };

      // Store cleanup function for later use
      (controller as any).cleanup = cleanup;
    },

    cancel() {
      // Clean up when connection is closed
      if ((this as any).cleanup) {
        (this as any).cleanup();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}

// Broadcast event to all connections in a campaign
export function broadcastToCampaign(
  campaignId: string, 
  event: any, 
  excludeController?: ReadableStreamDefaultController
) {
  const campaignConnections = connections.get(campaignId);
  if (!campaignConnections) return;

  const eventData = `data: ${JSON.stringify(event)}\n\n`;

  campaignConnections.forEach(controller => {
    if (controller !== excludeController) {
      try {
        controller.enqueue(eventData);
      } catch (error) {
        // Connection is closed, remove it
        campaignConnections.delete(controller);
      }
    }
  });
}
