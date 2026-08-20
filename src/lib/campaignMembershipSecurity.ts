export const CAMPAIGN_MEMBERSHIP_CSRF_HEADER = 'x-rollkeeper-csrf';

export function isCampaignMembershipServerEnabled(): boolean {
  return process.env.SUPABASE_CAMPAIGN_MEMBERSHIP_ENABLED === 'true';
}

export function isCampaignMembershipUiEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_CAMPAIGN_MEMBERSHIP_UI_ENABLED === 'true'
  );
}

export type CampaignMembershipMutationValidation =
  | { ok: true }
  | { ok: false; status: 403; error: string };

export function validateCampaignMembershipMutation(
  request: Pick<Request, 'url' | 'headers'>
): CampaignMembershipMutationValidation {
  const origin = request.headers.get('origin');
  const csrf = request.headers.get(CAMPAIGN_MEMBERSHIP_CSRF_HEADER);
  const contentType = request.headers.get('content-type') ?? '';
  const host = request.headers.get('host');
  const url = new URL(request.url);
  const requestOrigin = host ? `${url.protocol}//${host}` : url.origin;

  if (
    origin !== requestOrigin ||
    csrf !== '1' ||
    !/^application\/json(?:\s*;|$)/iu.test(contentType)
  ) {
    return {
      ok: false,
      status: 403,
      error: 'Request origin or CSRF validation failed',
    };
  }
  return { ok: true };
}
