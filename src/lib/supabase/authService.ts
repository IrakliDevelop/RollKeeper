interface AuthError {
  message: string;
}

interface OtpRequestClient {
  signInWithOtp(input: {
    email: string;
    options: { shouldCreateUser: true; captchaToken?: string };
  }): Promise<{ error: AuthError | null }>;
}

interface OtpVerificationClient {
  verifyOtp(input: {
    email: string;
    token: string;
    type: 'email';
  }): Promise<{ error: AuthError | null }>;
}

interface SignOutClient {
  signOut(): Promise<{ error: AuthError | null }>;
}

function throwAuthError(error: AuthError | null): void {
  if (error) throw new Error(error.message);
}

export async function requestEmailOtp(
  auth: OtpRequestClient,
  email: string,
  captchaToken?: string
): Promise<void> {
  const options: { shouldCreateUser: true; captchaToken?: string } = {
    shouldCreateUser: true,
  };
  if (captchaToken) options.captchaToken = captchaToken;

  const { error } = await auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options,
  });
  throwAuthError(error);
}

export async function verifyEmailOtp(
  auth: OtpVerificationClient,
  email: string,
  code: string
): Promise<void> {
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Enter the six-digit code from your email.');
  }

  const { error } = await auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code,
    type: 'email',
  });
  throwAuthError(error);
}

export async function signOutWithoutTouchingLegacyStorage(
  auth: SignOutClient
): Promise<void> {
  const { error } = await auth.signOut();
  throwAuthError(error);
}
