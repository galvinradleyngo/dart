import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uid } from './utils.js';

test('uid returns a valid UUID v4', () => {
  const id = uid();
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.match(id, uuidV4Regex);
});

test('uid generates unique identifiers', () => {
  const iterations = 1000;
  const ids = new Set();
  for (let i = 0; i < iterations; i++) {
    const id = uid();
    assert(!ids.has(id), `Duplicate id generated: ${id}`);
    ids.add(id);
  }
});
