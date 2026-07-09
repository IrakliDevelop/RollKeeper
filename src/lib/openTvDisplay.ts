export async function openTvDisplay(
  campaignCode: string,
  battleMapId: string,
  dmId: string
): Promise<void> {
  // Open the tab synchronously, in direct response to the user gesture —
  // Safari (and sometimes Chrome) revokes transient user activation across
  // an `await`, so opening after the fetch below would silently no-op.
  const win = window.open('', '_blank');

  let dk = '';
  try {
    const res = await fetch(`/api/campaign/${campaignCode}/display-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dmId }),
    });
    if (res.ok) {
      dk = ((await res.json()) as { displayKey?: string }).displayKey ?? '';
    }
  } catch {
    // relay not configured — the display page will show its own error state
  }

  const url = `/dm/campaign/${campaignCode}/battlemaps/${battleMapId}/display${
    dk ? `?dk=${encodeURIComponent(dk)}` : ''
  }`;

  if (win) {
    win.location.href = url;
  } else {
    // Popup blocked despite the synchronous open attempt — fall back to
    // the old behavior so at least some browsers still get a new tab.
    window.open(url, '_blank');
  }
}
