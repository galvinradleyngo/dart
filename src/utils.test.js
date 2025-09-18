import { describe, it, expect } from 'vitest';
import { uid, normalizeUrl } from './utils.js';

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

describe('normalizeUrl', () => {
  it('returns normalized url when protocol is present', () => {
    const input = 'https://example.com/docs';
    expect(normalizeUrl(input)).toBe(new URL(input).toString());
  });

  it('adds https protocol when missing', () => {
    const input = 'www.google.com';
    expect(normalizeUrl(input)).toBe(new URL(`https://${input}`).toString());
  });

  it('returns null for invalid urls', () => {
    expect(normalizeUrl('not a url')).toBeNull();
    expect(normalizeUrl('')).toBeNull();
  });
});
