import { describe, it, expect } from 'vitest';
import { uid, normalizeUrl, ensureHexColor, withAlpha } from './utils.js';

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

describe('ensureHexColor', () => {
  it('returns a normalized 6 digit hex when valid', () => {
    expect(ensureHexColor('#FF00AA')).toBe('#ff00aa');
  });

  it('strips alpha when provided', () => {
    expect(ensureHexColor('#123456cc')).toBe('#123456');
  });

  it('falls back when invalid', () => {
    expect(ensureHexColor('not-a-color', '#abcdef')).toBe('#abcdef');
  });
});

describe('withAlpha', () => {
  it('appends the correct alpha channel', () => {
    expect(withAlpha('#123456', 0.5)).toBe('#12345680');
  });

  it('clamps the provided alpha value', () => {
    expect(withAlpha('#123456', 2)).toBe('#123456ff');
    expect(withAlpha('#123456', -1)).toBe('#12345600');
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
