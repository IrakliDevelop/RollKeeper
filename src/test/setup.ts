import '@testing-library/jest-dom/vitest';

process.env.UPSTASH_REDIS_REST_URL = 'http://localhost:8079';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test_token';

// Stubs for Radix Select to work under jsdom. Files that opt into
// `@vitest-environment node` have no DOM to stub.
if (typeof Element !== 'undefined') {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.scrollIntoView = () => {};
}
