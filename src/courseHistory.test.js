import { describe, it, beforeEach, expect, vi } from 'vitest';
import { loadCourseHistoryEntries } from './App.jsx';

const COURSE_HISTORY_KEY = 'healthPM:courseHistory:v1';

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

vi.mock('./firebase.js', () => ({ db: {} }));

const getDocsMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn().mockResolvedValue(),
  doc: vi.fn(),
  collection: vi.fn(() => ({})),
  addDoc: vi.fn(),
  getDocs: (...args) => getDocsMock(...args),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(() => ({ delete: vi.fn(), commit: vi.fn().mockResolvedValue() })),
  query: vi.fn((...args) => args),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  serverTimestamp: vi.fn(),
}));

const makeRemovedCourse = (id, name) => ({
  id,
  course: { id, name },
  tasks: [],
  milestones: [],
  schedule: { workweek: [1, 2, 3, 4, 5], holidays: [] },
});

const readStoredHistory = () => {
  const raw = localStorage.getItem(COURSE_HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
};

describe('loadCourseHistoryEntries local fallbacks', () => {
  beforeEach(() => {
    localStorage.clear();
    getDocsMock.mockReset();
  });

  it('returns locally cached deletions when Firestore fails', async () => {
    const removedCourse = makeRemovedCourse('course-1', 'Course One');
    const fallbackEntry = {
      id: 'local-1',
      courseId: 'course-1',
      course: removedCourse,
      action: 'delete',
      position: 0,
      createdAt: 1_000,
    };
    localStorage.setItem(COURSE_HISTORY_KEY, JSON.stringify([fallbackEntry]));
    getDocsMock.mockRejectedValue(new Error('firestore down'));

    const entries = await loadCourseHistoryEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: 'local-1', courseId: 'course-1', action: 'delete' });
    expect(entries[0].course.course.name).toBe('Course One');
    expect(readStoredHistory()).toHaveLength(1);
  });

  it('removes duplicate cached entries when remote data succeeds', async () => {
    const removedCourse = makeRemovedCourse('course-1', 'Course One');
    const fallbackEntry = {
      id: 'remote-1',
      courseId: 'course-1',
      course: removedCourse,
      action: 'delete',
      position: 0,
      createdAt: 1_000,
    };
    localStorage.setItem(COURSE_HISTORY_KEY, JSON.stringify([fallbackEntry]));
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: 'remote-1',
          data: () => ({
            password: 'passthesalt',
            courseId: 'course-1',
            course: removedCourse,
            action: 'delete',
            position: 0,
            createdAt: { toMillis: () => 2_000 },
          }),
        },
      ],
    });

    const entries = await loadCourseHistoryEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('remote-1');
    expect(readStoredHistory()).toEqual([]);
  });

  it('merges cached fallbacks with remote history', async () => {
    const removedCourse = makeRemovedCourse('course-1', 'Course One');
    const fallbackEntry = {
      id: 'local-2',
      courseId: 'course-1',
      course: removedCourse,
      action: 'delete',
      position: 1,
      createdAt: 500,
    };
    localStorage.setItem(COURSE_HISTORY_KEY, JSON.stringify([fallbackEntry]));
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: 'remote-2',
          data: () => ({
            password: 'passthesalt',
            courseId: 'course-1',
            course: removedCourse,
            action: 'delete',
            position: 0,
            createdAt: { toMillis: () => 2_000 },
          }),
        },
      ],
    });

    const entries = await loadCourseHistoryEntries();

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.id)).toEqual(['remote-2', 'local-2']);
    expect(readStoredHistory().map((entry) => entry.id)).toEqual(['local-2']);
  });
});
