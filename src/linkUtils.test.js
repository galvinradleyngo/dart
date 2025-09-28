import { describe, it, expect } from 'vitest';
import { applyLinkPatch, syncLinkLibraryWithMilestone } from './linkUtils.js';

const sampleTasks = [
  { id: 't1', milestoneId: 'm1', links: [] },
  { id: 't2', milestoneId: 'm1', links: [] },
  { id: 't3', milestoneId: 'm2', links: [] },
];

describe('applyLinkPatch', () => {
  it('adds a link only to the targeted task', () => {
    const result = applyLinkPatch(sampleTasks, 't1', 'add', 'url');
    expect(result.find((t) => t.id === 't1').links).toEqual(['url']);
    expect(result.find((t) => t.id === 't2').links).toHaveLength(0);
    expect(result.find((t) => t.id === 't3').links).toHaveLength(0);
  });

  it('does not duplicate an existing link on the same task', () => {
    const withLink = [
      { id: 't1', milestoneId: 'm1', links: ['a'] },
      { id: 't2', milestoneId: 'm1', links: [] },
    ];
    const result = applyLinkPatch(withLink, 't1', 'add', 'a');
    expect(result.find((t) => t.id === 't1').links).toEqual(['a']);
  });

  it('removes a link only from the targeted task', () => {
    const withLink = [
      { id: 't1', milestoneId: 'm1', links: ['a'] },
      { id: 't2', milestoneId: 'm1', links: ['a'] },
    ];
    const result = applyLinkPatch(withLink, 't1', 'remove', 0);
    expect(result.find((t) => t.id === 't1').links).toHaveLength(0);
    expect(result.find((t) => t.id === 't2').links).toEqual(['a']);
  });
});

describe('syncLinkLibraryWithMilestone', () => {
  it('creates a single milestone entry when only one link exists', () => {
    const tasks = [
      { id: 'a', milestoneId: 'm', title: 'Task A', order: 0, links: ['https://example.com/a'] },
    ];
    const library = syncLinkLibraryWithMilestone({
      tasks,
      library: [],
      milestoneId: 'm',
      milestoneTitle: 'Milestone A',
      uidFn: () => 'id-1',
    });

    expect(library).toEqual([
      {
        id: 'id-1',
        label: 'Milestone A',
        url: 'https://example.com/a',
        milestoneId: 'm',
        taskId: 'a',
        source: 'task',
      },
    ]);
  });

  it('labels entries with task names when multiple unique links exist', () => {
    const tasks = [
      { id: 'a', milestoneId: 'm', title: 'Task A', order: 0, links: ['https://example.com/a'] },
      { id: 'b', milestoneId: 'm', title: 'Task B', order: 1, links: ['https://example.com/b'] },
    ];
    const library = syncLinkLibraryWithMilestone({
      tasks,
      library: [],
      milestoneId: 'm',
      milestoneTitle: 'Milestone A',
      uidFn: (() => {
        const ids = ['id-a', 'id-b'];
        return () => ids.shift();
      })(),
    });

    expect(library).toEqual([
      {
        id: 'id-a',
        label: 'Milestone A - Task A',
        url: 'https://example.com/a',
        milestoneId: 'm',
        taskId: 'a',
        source: 'task',
      },
      {
        id: 'id-b',
        label: 'Milestone A - Task B',
        url: 'https://example.com/b',
        milestoneId: 'm',
        taskId: 'b',
        source: 'task',
      },
    ]);
  });

  it('deduplicates shared links across tasks in the same milestone', () => {
    const tasks = [
      { id: 'a', milestoneId: 'm', title: 'Task A', order: 0, links: ['https://example.com/shared'] },
      { id: 'b', milestoneId: 'm', title: 'Task B', order: 1, links: ['https://example.com/shared'] },
    ];
    const library = syncLinkLibraryWithMilestone({
      tasks,
      library: [],
      milestoneId: 'm',
      milestoneTitle: 'Milestone A',
      uidFn: () => 'shared-id',
    });

    expect(library).toEqual([
      {
        id: 'shared-id',
        label: 'Milestone A',
        url: 'https://example.com/shared',
        milestoneId: 'm',
        taskId: 'a',
        source: 'task',
      },
    ]);
  });

  it('removes milestone entries when no tasks have links', () => {
    const previous = [
      {
        id: 'old',
        label: 'Milestone A',
        url: 'https://example.com/a',
        milestoneId: 'm',
        taskId: 'a',
        source: 'task',
      },
    ];
    const tasks = [{ id: 'a', milestoneId: 'm', title: 'Task A', order: 0, links: [] }];
    const library = syncLinkLibraryWithMilestone({
      tasks,
      library: previous,
      milestoneId: 'm',
      milestoneTitle: 'Milestone A',
      uidFn: () => 'unused',
    });

    expect(library).toEqual([]);
  });
});
