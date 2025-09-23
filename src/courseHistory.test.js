import { describe, it, beforeEach, expect, vi } from 'vitest';
import {
  loadCourseHistoryEntries,
  addCourseHistoryEntryLocal,
  loadCourseHistoryCache,
  courseHistoryInternal,
} from './courseHistoryStore.js';

const { loadPendingEntries } = courseHistoryInternal;

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
const addDocMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn().mockResolvedValue(),
  doc: vi.fn(),
  collection: vi.fn(() => ({})),
  addDoc: (...args) => addDocMock(...args),
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

describe('loadCourseHistoryEntries local fallbacks', () => {
  beforeEach(() => {
    localStorage.clear();
    getDocsMock.mockReset();
    addDocMock.mockReset();
  });

  it('returns locally cached deletions when Firestore fails', async () => {
    const removedCourse = makeRemovedCourse('course-1', 'Course One');
    const fallbackEntry = addCourseHistoryEntryLocal({
      id: 'local-1',
      courseId: 'course-1',
      course: removedCourse,
      action: 'delete',
      position: 0,
      createdAt: 1_000,
    });
    addDocMock.mockRejectedValue(new Error('firestore down'));
    getDocsMock.mockRejectedValue(new Error('firestore down'));

    const entries = await loadCourseHistoryEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: fallbackEntry.id, courseId: 'course-1', action: 'delete' });
    expect(entries[0].course.course.name).toBe('Course One');
    expect(loadCourseHistoryCache()).toHaveLength(1);
    expect(loadPendingEntries()).toHaveLength(1);
  });

  it('removes duplicate cached entries when remote data succeeds', async () => {
    const removedCourse = makeRemovedCourse('course-1', 'Course One');
    const fallbackEntry = addCourseHistoryEntryLocal({
      id: 'local-remote',
      courseId: 'course-1',
      course: removedCourse,
      action: 'delete',
      position: 0,
      createdAt: 1_000,
    });
    addDocMock.mockResolvedValue({ id: 'remote-1' });
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
            clientId: fallbackEntry.id,
            createdAt: { toMillis: () => 2_000 },
          }),
        },
      ],
    });

    const entries = await loadCourseHistoryEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('remote-1');
    expect(entries[0].clientId).toBe(fallbackEntry.id);
    expect(loadPendingEntries()).toHaveLength(0);
    expect(loadCourseHistoryCache().map((entry) => entry.id)).toEqual(['remote-1']);
  });

  it('merges cached fallbacks with remote history', async () => {
    const removedCourse = makeRemovedCourse('course-1', 'Course One');
    const fallbackEntry = addCourseHistoryEntryLocal({
      id: 'local-2',
      courseId: 'course-1',
      course: removedCourse,
      action: 'delete',
      position: 1,
      createdAt: 500,
    });
    addDocMock.mockRejectedValue(new Error('firestore down'));
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
    expect(entries.map((entry) => entry.id)).toEqual(['remote-2', fallbackEntry.id]);
    expect(loadPendingEntries().map((entry) => entry.id)).toEqual([fallbackEntry.id]);
    const cachedIds = loadCourseHistoryCache().map((entry) => entry.id);
    expect(cachedIds).toEqual(['remote-2', fallbackEntry.id]);
  });

  it('retries without ordering when the Firestore index is missing', async () => {
    const removedCourse = makeRemovedCourse('course-1', 'Course One');
    const indexError = Object.assign(new Error('The query requires an index.'), {
      code: 'failed-precondition',
    });

    getDocsMock.mockImplementationOnce(() => Promise.reject(indexError));
    getDocsMock.mockImplementationOnce(() =>
      Promise.resolve({
        docs: [
          {
            id: 'remote-index-fallback',
            data: () => ({
              password: 'passthesalt',
              courseId: 'course-1',
              course: removedCourse,
              action: 'delete',
              position: 0,
              clientId: 'client-1',
              createdAt: { toMillis: () => 3_000 },
            }),
          },
        ],
      })
    );

    const entries = await loadCourseHistoryEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('remote-index-fallback');
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });
});
