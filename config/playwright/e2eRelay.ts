/**
 * The local relay the relay-backed e2e configs start. Specs that need to
 * recognise the relay socket import this instead of repeating the port.
 */
export const E2E_RELAY_PORT = 8787;
export const E2E_RELAY_URL = `ws://localhost:${E2E_RELAY_PORT}`;
export const E2E_RELAY_HEALTH_URL = `http://localhost:${E2E_RELAY_PORT}/healthz`;
