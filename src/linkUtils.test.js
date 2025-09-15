import { describe, it, expect } from 'vitest';
import { applyLinkPatch } from './linkUtils.js';

const tasks = [
  { id: 't1', milestoneId: 'm1', links: [] },
  { id: 't2', milestoneId: 'm1', links: [] },
  { id: 't3', milestoneId: 'm2', links: [] },
];

describe('applyLinkPatch', () => {
  it('adds link to all tasks in milestone', () => {
    const result = applyLinkPatch(tasks, 't1', 'add', 'url');
    expect(result.find((t) => t.id === 't1').links).toContain('url');
    expect(result.find((t) => t.id === 't2').links).toContain('url');
    expect(result.find((t) => t.id === 't3').links).toHaveLength(0);
  });
  it('removes link only from target task', () => {
    const withLink = [
      { id: 't1', milestoneId: 'm1', links: ['a'] },
      { id: 't2', milestoneId: 'm1', links: ['a'] },
    ];
    const result = applyLinkPatch(withLink, 't1', 'remove', 0);
    expect(result.find((t) => t.id === 't1').links).toHaveLength(0);
    expect(result.find((t) => t.id === 't2').links).toEqual(['a']);
  });
});
