import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractEmailOtp } from './extractEmailOtp';

describe('Supabase OTP email template', () => {
  it('keeps {{ .Token }} in a Mailpit-parseable branded block', () => {
    const html = readFileSync(
      resolve(process.cwd(), 'supabase/templates/otp.html'),
      'utf8'
    );
    expect(html).toContain('{{ .Token }}');

    const delivered = html.replaceAll('{{ .Token }}', '424242');
    expect(extractEmailOtp(delivered)).toBe('424242');
    expect(html).not.toMatch(/only for the browser/i);
    expect(html).toContain('Never share this code');
  });
});
