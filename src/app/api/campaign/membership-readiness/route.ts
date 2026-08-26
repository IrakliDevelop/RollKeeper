import { createHash } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { validateCampaignMembershipMutation } from '@/lib/campaignMembershipSecurity';
import { campaignPlayerKey, campaignPlayersKey, getRedis } from '@/lib/redis';
import type { CampaignMembershipRpcClient } from '@/lib/supabase/campaignMembershipGateway';
import { createCampaignMembershipContextForRequest } from '@/lib/supabase/campaignMembershipServer';
import type { CampaignPlayerData } from '@/types/campaign';

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value), 'utf8')
    .digest('hex');
}

async function call(
  client: CampaignMembershipRpcClient,
  name: string,
  args: Record<string, unknown>
) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function POST(request: NextRequest) {
  const security = validateCampaignMembershipMutation(request);
  if (!security.ok)
    return NextResponse.json(
      { error: security.error },
      { status: security.status }
    );
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (
    !body ||
    typeof body.action !== 'string' ||
    typeof body.campaignId !== 'string'
  ) {
    return NextResponse.json(
      { error: 'Campaign readiness action is required' },
      { status: 400 }
    );
  }
  const context = await createCampaignMembershipContextForRequest();
  if (!context?.userClient || !context.userGateway) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const userRpc = context.userClient as unknown as CampaignMembershipRpcClient;
  try {
    if (body.action === 'refresh') {
      if (typeof body.displayCode !== 'string')
        throw new Error('display code required');
      const auth = await context.userClient.auth.getUser();
      if (!auth.data.user) throw new Error('authentication required');
      const campaign = await context.userClient
        .from('campaigns')
        .select('display_code')
        .eq('id', body.campaignId)
        .single();
      if (campaign.error || campaign.data.display_code !== body.displayCode) {
        throw new Error('campaign owner authorization required');
      }
      const redis = getRedis();
      const ids = (
        await redis.smembers(campaignPlayersKey(body.displayCode))
      ).filter(id => id !== '__init__');
      const entries: Array<Record<string, unknown>> = [];
      if (ids.length > 0) {
        const pipeline = redis.pipeline();
        for (const id of ids)
          pipeline.get(campaignPlayerKey(body.displayCode, id));
        const rows = await pipeline.exec();
        rows.forEach((raw, index) => {
          const player = (
            typeof raw === 'string' ? JSON.parse(raw) : raw
          ) as CampaignPlayerData | null;
          const sourceId = ids[index];
          const label =
            player?.playerName ||
            player?.characterName ||
            `Legacy roster ${index + 1}`;
          entries.push({
            kind: 'legacy_roster',
            sourceId,
            label,
            fingerprint: fingerprint({
              sourceId,
              characterId: player?.characterId ?? null,
              revision: player?.characterData?.revision ?? 0,
            }),
          });
        });
      }
      const guestAccess = await call(userRpc, 'list_campaign_guest_access', {
        p_campaign_id: body.campaignId,
      });
      const sessions =
        typeof guestAccess === 'object' &&
        guestAccess !== null &&
        Array.isArray((guestAccess as { sessions?: unknown }).sessions)
          ? (guestAccess as { sessions: Array<Record<string, unknown>> })
              .sessions
          : [];
      for (const session of sessions) {
        if (typeof session.subjectId !== 'string') continue;
        entries.push({
          kind: 'guest_subject',
          sourceId: session.subjectId,
          label: 'Hybrid guest subject',
          fingerprint: fingerprint({
            subjectId: session.subjectId,
            legacyPlayerId: session.legacyPlayerId ?? null,
          }),
        });
      }
      if (Array.isArray(body.removalTombstones)) {
        for (const value of body.removalTombstones) {
          if (typeof value !== 'string') continue;
          entries.push({
            kind: 'removal_tombstone',
            sourceId: value,
            label: 'Legacy removal tombstone',
            fingerprint: fingerprint({ removal: value }),
          });
        }
      }
      const shadow = await call(
        context.applicationClient,
        'replace_campaign_membership_shadow',
        {
          p_mutation_id: crypto.randomUUID(),
          p_owner_id: auth.data.user.id,
          p_campaign_id: body.campaignId,
          p_entries: entries,
        }
      );
      return NextResponse.json(
        {
          shadow,
          entries: entries.map(entry => ({
            kind: entry.kind,
            sourceId: entry.sourceId,
            label: entry.label,
          })),
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (body.action === 'prepare') {
      return NextResponse.json(
        await call(userRpc, 'prepare_campaign_membership_manifest', {
          p_mutation_id:
            typeof body.mutationId === 'string'
              ? body.mutationId
              : crypto.randomUUID(),
          p_campaign_id: body.campaignId,
        }),
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (body.action === 'classify') {
      return NextResponse.json(
        await call(userRpc, 'classify_campaign_membership_shadow', {
          p_mutation_id: body.mutationId,
          p_campaign_id: body.campaignId,
          p_entry_kind: body.entryKind,
          p_source_id: body.sourceId,
          p_classification: body.classification,
        }),
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (body.action === 'cutover') {
      if (
        typeof body.fingerprint !== 'string' ||
        typeof body.version !== 'number'
      )
        throw new Error('exact manifest confirmation required');
      const replay = await call(userRpc, 'replay_campaign_membership_cutover', {
        p_mutation_id: body.mutationId,
        p_campaign_id: body.campaignId,
        p_manifest_fingerprint: body.fingerprint,
        p_manifest_version: body.version,
      });
      if (replay !== null) {
        return NextResponse.json(replay, {
          headers: { 'Cache-Control': 'no-store' },
        });
      }
      await call(userRpc, 'begin_campaign_membership_freeze', {
        p_mutation_id: crypto.randomUUID(),
        p_campaign_id: body.campaignId,
        p_manifest_fingerprint: body.fingerprint,
        p_manifest_version: body.version,
      });
      try {
        return NextResponse.json(
          await call(userRpc, 'confirm_campaign_membership_cutover', {
            p_mutation_id: body.mutationId,
            p_campaign_id: body.campaignId,
            p_manifest_fingerprint: body.fingerprint,
            p_manifest_version: body.version,
          }),
          { headers: { 'Cache-Control': 'no-store' } }
        );
      } catch (error) {
        await call(userRpc, 'cancel_campaign_membership_freeze', {
          p_mutation_id: crypto.randomUUID(),
          p_campaign_id: body.campaignId,
        }).catch(() => undefined);
        throw error;
      }
    }
    if (body.action === 'rollback') {
      return NextResponse.json(
        await call(userRpc, 'rollback_campaign_membership', {
          p_mutation_id: body.mutationId,
          p_campaign_id: body.campaignId,
          p_expected_epoch: body.expectedEpoch,
          p_generation: body.generation,
          p_generation_fingerprint: body.generationFingerprint,
        }),
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: 'Unknown readiness action' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Membership readiness action was denied or stale' },
      { status: 409 }
    );
  }
}
