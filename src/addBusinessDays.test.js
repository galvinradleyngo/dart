import { describe, it, expect } from 'vitest';
import { addBusinessDays } from './utils.js';

describe('addBusinessDays', () => {
  it('advances past weekends', () => {
    const result = addBusinessDays('2025-01-10', 1, [1,2,3,4,5], []);
    expect(result).toBe('2025-01-13');
  });

  it('skips holidays', () => {
    const result = addBusinessDays('2025-01-10', 1, [1,2,3,4,5], ['2025-01-13']);
    expect(result).toBe('2025-01-14');
  });

  it('supports custom workweeks', () => {
    const result = addBusinessDays('2025-01-09', 1, [0,6], []);
    expect(['2025-01-11', '2025-01-12']).toContain(result);
  });
});
