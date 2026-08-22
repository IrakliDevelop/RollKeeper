import { NextRequest, NextResponse } from 'next/server';

import { validateCampaignMembershipMutation } from '@/lib/campaignMembershipSecurity';
import {
  callMagicItemRpc,
  createMagicItemUserClient,
} from '@/lib/supabase/magicItemServer';

function unavailable() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const security = validateCampaignMembershipMutation(request);
  if (!security.ok)
    return NextResponse.json(
      { error: security.error },
      { status: security.status }
    );
  const client = await createMagicItemUserClient();
  if (!client) return unavailable();
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body.action !== 'string')
    return NextResponse.json(
      { error: 'Magic item action is required' },
      { status: 400 }
    );
  try {
    let name: string;
    let args: Record<string, unknown>;
    switch (body.action) {
      case 'begin-staging':
        name = 'begin_magic_item_staging';
        args = {
          p_mutation_id: body.mutationId,
          p_campaign_id: body.campaignId,
          p_device_id: body.deviceId,
          p_expected_epoch: body.expectedEpoch,
          p_manifest_fingerprint: body.manifestFingerprint,
          p_recovery_manifest_hash: body.recoveryManifestHash,
          p_recovery_receipt_hash: body.recoveryReceiptHash,
          p_record_count: body.recordCount,
          p_total_bytes: body.totalBytes,
        };
        break;
      case 'stage-items':
        name = 'stage_magic_item_items';
        args = {
          p_mutation_id: body.mutationId,
          p_run_id: body.runId,
          p_items: body.items,
        };
        break;
      case 'confirm-cutover':
        name = 'confirm_magic_item_cutover';
        args = {
          p_mutation_id: body.mutationId,
          p_run_id: body.runId,
          p_manifest_fingerprint: body.manifestFingerprint,
          p_expected_epoch: body.expectedEpoch,
        };
        break;
      case 'put':
        name = 'put_magic_item_document';
        args = {
          p_mutation_id: body.mutationId,
          p_campaign_id: body.campaignId,
          p_expected_epoch: body.expectedEpoch,
          p_legacy_id: body.legacyId,
          p_operation: body.operation,
          p_expected_server_version: body.expectedServerVersion,
          p_schema_version: body.schemaVersion,
          p_payload: body.payload,
          p_payload_fingerprint: body.payloadFingerprint,
        };
        break;
      case 'history':
        name = 'list_magic_item_document_versions';
        args = { p_campaign_id: body.campaignId, p_legacy_id: body.legacyId };
        break;
      case 'export-version':
        name = 'export_magic_item_document_version';
        args = {
          p_campaign_id: body.campaignId,
          p_legacy_id: body.legacyId,
          p_server_version: body.serverVersion,
        };
        break;
      case 'compare-versions':
        name = 'compare_magic_item_document_versions';
        args = {
          p_campaign_id: body.campaignId,
          p_legacy_id: body.legacyId,
          p_left: body.leftVersion,
          p_right: body.rightVersion,
        };
        break;
      case 'restore-version':
        name = 'restore_magic_item_document_version';
        args = {
          p_mutation_id: body.mutationId,
          p_campaign_id: body.campaignId,
          p_expected_epoch: body.expectedEpoch,
          p_legacy_id: body.legacyId,
          p_source_version: body.sourceVersion,
          p_expected_server_version: body.expectedServerVersion,
        };
        break;
      case 'preview-enrollment':
        name = 'preview_magic_item_device_enrollment';
        args = { p_campaign_id: body.campaignId };
        break;
      case 'enroll-device':
        name = 'enroll_magic_item_device';
        args = {
          p_mutation_id: body.mutationId,
          p_campaign_id: body.campaignId,
          p_device_id: body.deviceId,
          p_expected_epoch: body.expectedEpoch,
          p_preview_fingerprint: body.previewFingerprint,
          p_legacy_candidate_fingerprint:
            body.legacyCandidateFingerprint ?? null,
        };
        break;
      case 'remove-device':
        name = 'remove_magic_item_device';
        args = {
          p_mutation_id: body.mutationId,
          p_campaign_id: body.campaignId,
          p_device_id: body.deviceId,
          p_expected_epoch: body.expectedEpoch,
        };
        break;
      case 'rollback':
        name = 'rollback_magic_item_family';
        args = {
          p_mutation_id: body.mutationId,
          p_campaign_id: body.campaignId,
          p_expected_epoch: body.expectedEpoch,
          p_preview_fingerprint: body.previewFingerprint,
          p_current_generation: body.currentGeneration,
        };
        break;
      default:
        return NextResponse.json(
          { error: 'Unknown magic item action' },
          { status: 400 }
        );
    }
    const data = await callMagicItemRpc(client, name, args);
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
            ? 'Magic item library changed; refresh and reconcile.'
            : 'Magic item request was denied.',
      },
      {
        status: code === '40001' ? 409 : 403,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
