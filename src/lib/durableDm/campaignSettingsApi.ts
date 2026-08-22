export async function campaignSettingsApi<T>(
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch('/api/campaign-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-rollkeeper-csrf': '1' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error(
      response.status === 409
        ? 'Campaign settings changed on another device.'
        : 'Campaign settings cloud request failed.'
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return (await response.json()) as T;
}
