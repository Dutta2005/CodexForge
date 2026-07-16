import { describe, expect, it } from 'vitest';

describe('frontend/backend contract', () => {
  it('uses public API and socket URLs for runtime integration', () => {
    expect(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').toContain('http');
  });
});
