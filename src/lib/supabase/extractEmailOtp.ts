/** Extracts a six-digit email OTP from a Mailpit message payload. */
export function extractEmailOtp(serialized: string): string | null {
  const branded = serialized.match(/rk-code[^>]*>\s*(\d{6})/);
  if (branded) return branded[1];
  const nearExpiry = serialized.match(
    /(\d{6})[\s\S]{0,240}Expires in 10 minutes/
  );
  if (nearExpiry) return nearExpiry[1];
  const legacy = serialized.match(/RollKeeper sign-in code[^0-9]*(\d{6})/u);
  if (legacy) return legacy[1];
  return null;
}
