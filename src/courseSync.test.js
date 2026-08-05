import { describe, it, expect } from 'vitest';
import { mergeCourseSnapshots } from './courseSync';

describe('mergeCourseSnapshots', () => {
  it('preserves local and remote course data when both snapshots contain the same course', () => {
    const localCourses = [
      {
        id: 'course-1',
        title: 'Local course',
        updatedAt: 100,
        tasks: [{ id: 'task-1', title: 'Local task' }],
      },
    ];
    const remoteCourses = [
      {
        id: 'course-1',
        title: 'Remote course',
        updatedAt: 200,
        tasks: [{ id: 'task-2', title: 'Remote task' }],
      },
    ];

    const merged = mergeCourseSnapshots(localCourses, remoteCourses);

    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('Remote course');
    expect(merged[0].tasks).toHaveLength(2);
    expect(merged[0].tasks.map((task) => task.id)).toEqual(expect.arrayContaining(['task-1', 'task-2']));
  });

  it('keeps courses that exist only in the local snapshot', () => {
    const localCourses = [{ id: 'course-local', title: 'Local only', tasks: [] }];
    const remoteCourses = [{ id: 'course-remote', title: 'Remote only', tasks: [] }];

    const merged = mergeCourseSnapshots(localCourses, remoteCourses);

    expect(merged).toHaveLength(2);
    expect(merged.map((course) => course.id)).toEqual(expect.arrayContaining(['course-local', 'course-remote']));
  });
});
