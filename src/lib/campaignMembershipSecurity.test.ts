import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isCampaignMembershipServerEnabled,
  isCampaignMembershipUiEnabled,
  validateCampaignMembershipMutation,
} from './campaignMembershipSecurity';

afterEach(() => vi.unstubAllEnvs());

describe('campaign membership gates and mutation security', () => {
  it('is independently default-off on server and client', () => {
    expect(isCampaignMembershipServerEnabled()).toBe(false);
    expect(isCampaignMembershipUiEnabled()).toBe(false);
    vi.stubEnv('SUPABASE_CAMPAIGN_MEMBERSHIP_ENABLED', 'true');
    expect(isCampaignMembershipServerEnabled()).toBe(true);
    expect(isCampaignMembershipUiEnabled()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_CAMPAIGN_MEMBERSHIP_UI_ENABLED', 'true');
    expect(isCampaignMembershipUiEnabled()).toBe(true);
  });

  it('requires exact same-origin JSON and CSRF for every membership mutation', () => {
    const valid = new Request(
      'https://rk-pr-a.localhost/api/campaign/membership',
      {
        method: 'POST',
        headers: {
          origin: 'https://rk-pr-a.localhost',
          host: 'rk-pr-a.localhost',
          'content-type': 'application/json',
          'x-rollkeeper-csrf': '1',
        },
      }
    );
    expect(validateCampaignMembershipMutation(valid)).toEqual({ ok: true });

    for (const headers of [
      {
        origin: 'https://evil.localhost',
        host: 'rk-pr-a.localhost',
        'content-type': 'application/json',
        'x-rollkeeper-csrf': '1',
      },
      {
        origin: 'https://rk-pr-a.localhost',
        host: 'rk-pr-a.localhost',
        'content-type': 'text/plain',
        'x-rollkeeper-csrf': '1',
      },
      {
        origin: 'https://rk-pr-a.localhost',
        host: 'rk-pr-a.localhost',
        'content-type': 'application/json',
      },
    ]) {
      expect(
        validateCampaignMembershipMutation(
          new Request('https://rk-pr-a.localhost/api/campaign/membership', {
            method: 'POST',
            headers: new Headers(
              Object.entries(headers).filter(
                (entry): entry is [string, string] =>
                  typeof entry[1] === 'string'
              )
            ),
          })
        )
      ).toMatchObject({ ok: false, status: 403 });
    }

    expect(
      validateCampaignMembershipMutation(
        new Request('https://rk-pr-a.localhost/api/campaign/membership', {
          headers: {
            origin: 'https://rk-pr-a.localhost',
            'content-type': 'application/json; charset=utf-8',
            'x-rollkeeper-csrf': '1',
          },
        })
      )
    ).toEqual({ ok: true });
  });
});
