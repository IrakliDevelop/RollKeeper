/**
 * The local relay the relay-backed e2e configs start. Specs that need to
 * recognise the relay socket import this instead of repeating the port.
 */
// Isolated local runs may reserve another port; CI keeps the shared default.
export const E2E_RELAY_PORT = Number(
  process.env.ROLLKEEPER_E2E_RELAY_PORT ?? 8787
);
export const E2E_RELAY_URL = `ws://localhost:${E2E_RELAY_PORT}`;
export const E2E_RELAY_HEALTH_URL = `http://localhost:${E2E_RELAY_PORT}/healthz`;
