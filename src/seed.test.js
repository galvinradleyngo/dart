import { describe, it, expect } from 'vitest';
import { seed } from './App.jsx';

describe('seed()', () => {
  it('defaults to an empty project when no sample data is requested', () => {
    const project = seed();
    expect(Array.isArray(project.milestones)).toBe(true);
    expect(Array.isArray(project.tasks)).toBe(true);
    expect(project.milestones).toHaveLength(0);
    expect(project.tasks).toHaveLength(0);
    expect(Array.isArray(project.linkLibrary)).toBe(true);
    expect(project.linkLibrary).toHaveLength(0);
  });
});
