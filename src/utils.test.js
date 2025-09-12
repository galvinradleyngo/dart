import { describe, it, expect } from 'vitest';
import { uid } from './utils.js';

describe('uid', () => {
  it('returns a valid UUID v4', () => {
    const id = uid();
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidV4Regex);
  });

  it('generates unique identifiers', () => {
    const iterations = 1000;
    const ids = new Set();
    for (let i = 0; i < iterations; i++) {
      const id = uid();
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
  });
});
