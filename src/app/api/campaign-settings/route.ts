import { NextRequest, NextResponse } from 'next/server';

import { validateCampaignMembershipMutation } from '@/lib/campaignMembershipSecurity';
import {
  callCampaignSettingsRpc,
  createCampaignSettingsUserClient,
} from '@/lib/supabase/campaignSettingsServer';

function unavailable() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

function string(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export async function POST(request: NextRequest) {
  const security = validateCampaignMembershipMutation(request);
  if (!security.ok) {
    return NextResponse.json(
      { error: security.error },
      { status: security.status }
    );
  }
  const client = await createCampaignSettingsUserClient();
  if (!client) return unavailable();
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || !string(body.action)) {
    return NextResponse.json(
      { error: 'Campaign settings action is required' },
      { status: 400 }
    );
  }
  try {
    let data: unknown;
    let drainProjection = false;
    switch (body.action) {
      case 'begin-staging':
        data = await callCampaignSettingsRpc(
          client,
          'begin_campaign_settings_staging',
          {
            p_mutation_id: body.mutationId,
            p_campaign_id: body.campaignId,
            p_device_id: body.deviceId,
            p_expected_epoch: body.expectedEpoch,
            p_manifest_fingerprint: body.manifestFingerprint,
            p_recovery_manifest_hash: body.recoveryManifestHash,
            p_recovery_receipt_hash: body.recoveryReceiptHash,
            p_record_count: body.recordCount,
            p_total_bytes: body.totalBytes,
          }
        );
        break;
      case 'stage-items':
        data = await callCampaignSettingsRpc(
          client,
          'stage_campaign_settings_items',
          {
            p_mutation_id: body.mutationId,
            p_run_id: body.runId,
            p_items: body.items,
          }
        );
        break;
      case 'confirm-cutover':
        data = await callCampaignSettingsRpc(
          client,
          'confirm_campaign_settings_cutover',
          {
            p_mutation_id: body.mutationId,
            p_run_id: body.runId,
            p_manifest_fingerprint: body.manifestFingerprint,
            p_expected_epoch: body.expectedEpoch,
          }
        );
        drainProjection = true;
        break;
      case 'put':
        data = await callCampaignSettingsRpc(client, 'put_campaign_document', {
          p_mutation_id: body.mutationId,
          p_campaign_id: body.campaignId,
          p_family: 'campaign_settings',
          p_expected_epoch: body.expectedEpoch,
          p_legacy_id: body.legacyId,
          p_operation: body.operation,
          p_expected_server_version: body.expectedServerVersion,
          p_schema_version: body.schemaVersion,
          p_payload: body.payload,
          p_payload_fingerprint: body.payloadFingerprint,
        });
        drainProjection = true;
        break;
      case 'history':
        data = await callCampaignSettingsRpc(
          client,
          'list_campaign_document_versions',
          {
            p_campaign_id: body.campaignId,
            p_family: 'campaign_settings',
            p_legacy_id: body.legacyId,
          }
        );
        break;
      case 'export-version':
        data = await callCampaignSettingsRpc(
          client,
          'export_campaign_document_version',
          {
            p_campaign_id: body.campaignId,
            p_family: 'campaign_settings',
            p_legacy_id: body.legacyId,
            p_server_version: body.serverVersion,
          }
        );
        break;
      case 'compare-versions':
        data = await callCampaignSettingsRpc(
          client,
          'compare_campaign_document_versions',
          {
            p_campaign_id: body.campaignId,
            p_family: 'campaign_settings',
            p_legacy_id: body.legacyId,
            p_left: body.leftVersion,
            p_right: body.rightVersion,
          }
        );
        break;
      case 'restore-version':
        data = await callCampaignSettingsRpc(
          client,
          'restore_campaign_document_version',
          {
            p_mutation_id: body.mutationId,
            p_campaign_id: body.campaignId,
            p_family: 'campaign_settings',
            p_expected_epoch: body.expectedEpoch,
            p_legacy_id: body.legacyId,
            p_source_version: body.sourceVersion,
            p_expected_server_version: body.expectedServerVersion,
          }
        );
        drainProjection = true;
        break;
      case 'repair-current':
        data = await callCampaignSettingsRpc(
          client,
          'repair_campaign_document_current_from_history',
          {
            p_mutation_id: body.mutationId,
            p_campaign_id: body.campaignId,
            p_family: 'campaign_settings',
            p_expected_epoch: body.expectedEpoch,
            p_legacy_id: body.legacyId,
            p_expected_latest_version: body.expectedLatestVersion,
            p_expected_latest_fingerprint: body.expectedLatestFingerprint,
          }
        );
        drainProjection = true;
        break;
      case 'enroll-device':
        data = await callCampaignSettingsRpc(
          client,
          'enroll_campaign_settings_device',
          {
            p_mutation_id: body.mutationId,
            p_campaign_id: body.campaignId,
            p_device_id: body.deviceId,
            p_expected_epoch: body.expectedEpoch,
            p_preview_fingerprint: body.previewFingerprint,
            p_legacy_candidate_fingerprint:
              body.legacyCandidateFingerprint ?? null,
          }
        );
        break;
      case 'preview-enrollment':
        data = await callCampaignSettingsRpc(
          client,
          'preview_campaign_settings_device_enrollment',
          {
            p_campaign_id: body.campaignId,
          }
        );
        break;
      case 'remove-device':
        data = await callCampaignSettingsRpc(
          client,
          'remove_campaign_settings_device',
          {
            p_mutation_id: body.mutationId,
            p_campaign_id: body.campaignId,
            p_device_id: body.deviceId,
            p_expected_epoch: body.expectedEpoch,
          }
        );
        break;
      case 'projection-status':
        data = await callCampaignSettingsRpc(
          client,
          'campaign_document_projection_status',
          {
            p_campaign_id: body.campaignId,
            p_family: 'campaign_settings',
          }
        );
        break;
      case 'projection-incidents':
        data = await callCampaignSettingsRpc(
          client,
          'list_campaign_document_projection_incidents',
          {
            p_campaign_id: body.campaignId,
            p_family: 'campaign_settings',
          }
        );
        break;
      case 'replay-projection':
        data = await callCampaignSettingsRpc(
          client,
          'replay_campaign_document_projection_event',
          {
            p_mutation_id: body.mutationId,
            p_campaign_id: body.campaignId,
            p_expected_epoch: body.expectedEpoch,
            p_event_id: body.eventId,
          }
        );
        drainProjection = true;
        break;
      case 'rollback':
        data = await callCampaignSettingsRpc(
          client,
          'rollback_campaign_settings_family',
          {
            p_mutation_id: body.mutationId,
            p_campaign_id: body.campaignId,
            p_expected_epoch: body.expectedEpoch,
            p_manifest_fingerprint: body.manifestFingerprint,
            p_current_generation: body.currentGeneration,
            p_projection_journal_reconciled: body.projectionJournalReconciled,
          }
        );
        break;
      default:
        return NextResponse.json(
          { error: 'Unknown campaign settings action' },
          { status: 400 }
        );
    }
    if (drainProjection) {
      try {
        const { drainCampaignSettingsProjectionQueue } = await import(
          '@/lib/durableDm/campaignSettingsProjectionServer'
        );
        await drainCampaignSettingsProjectionQueue(5);
      } catch {
        // PostgreSQL durability is independent from compatibility publication.
      }
    }
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    const code =
      error instanceof Error && 'code' in error
        ? (error as Error & { code?: string }).code
        : undefined;
    return NextResponse.json(
      {
        error:
          code === '40001'
            ? 'Campaign settings changed; refresh and reconcile.'
            : 'Campaign settings request was denied.',
      },
      {
        status: code === '40001' ? 409 : 403,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
