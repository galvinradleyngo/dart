import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uid } from './utils.js';

test('uid returns 7-character string', () => {
  const id = uid();
  assert.match(id, /^[a-z0-9]{7}$/);
});

test('uid generates unique values', () => {
  const a = uid();
  const b = uid();
  assert.notStrictEqual(a, b);
});
