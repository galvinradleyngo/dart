import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { CoursesHub } from './App.jsx';

vi.mock('./firebase.js', () => ({ db: {} }));
const addDoc = vi.fn().mockResolvedValue({ id: 'history-doc' });
const getDocs = vi.fn().mockResolvedValue({ forEach: () => {}, docs: [] });
const deleteDoc = vi.fn().mockResolvedValue();

vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn().mockResolvedValue(),
  doc: vi.fn(),
  collection: vi.fn(() => ({})),
  addDoc,
  getDocs,
  query: vi.fn((...args) => args),
  where: vi.fn((...args) => args),
  orderBy: vi.fn((...args) => args),
  limit: vi.fn((...args) => args),
  serverTimestamp: vi.fn(() => ({ server: true })),
  deleteDoc,
  Timestamp: {
    fromMillis: (ms) => ({ toMillis: () => ms }),
  },
}));

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

describe('CoursesHub undo functionality', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    addDoc.mockClear();
    getDocs.mockClear();
    deleteDoc.mockClear();
    localStorage.setItem('healthPM:platformBackupLastRun:v1', String(Date.now()));
  });

  const renderHub = (props = {}) => {
    const {
      onApplyPlatformBackup = () => Promise.resolve(null),
      people = [],
      onPeopleChange = () => {},
      ...rest
    } = props;
    return render(
      <CoursesHub
        onOpenCourse={() => {}}
        onEditTemplate={() => {}}
        onAddCourse={() => {}}
        onOpenUser={() => {}}
        people={people}
        onPeopleChange={onPeopleChange}
        onApplyPlatformBackup={onApplyPlatformBackup}
        {...rest}
      />
    );
  };

  it('restores course list after deleting and undoing', async () => {
    const courses = [
      { id: 'c1', course: { id: 'c1', name: 'Course 1', description: '' }, tasks: [], team: [], schedule: {} },
      { id: 'c2', course: { id: 'c2', name: 'Course 2', description: '' }, tasks: [], team: [], schedule: {} },
    ];
    localStorage.setItem('healthPM:courses:v1', JSON.stringify(courses));

    renderHub();

    await screen.findByText('Course 1');
    await screen.findByText('Course 2');

    const undoButton = screen.getByRole('button', { name: 'Undo' });
    expect(undoButton).toBeDisabled();

    const deleteButton = screen.getAllByRole('button', { name: /Delete course/i })[0];
    fireEvent.click(deleteButton);

    expect(screen.queryByText('Course 1')).toBeNull();
    expect(undoButton).not.toBeDisabled();

    fireEvent.click(undoButton);

    await screen.findByText('Course 1');
    expect(undoButton).toBeDisabled();
  });

  it('supports undoing up to ten steps', async () => {
    const courses = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i + 1}`,
      course: { id: `c${i + 1}`, name: `Course ${i + 1}`, description: '' },
      tasks: [],
      team: [],
      schedule: {},
    }));
    localStorage.setItem('healthPM:courses:v1', JSON.stringify(courses));

    renderHub();
    await screen.findByText('Course 1');

    const undoButton = screen.getByRole('button', { name: 'Undo' });

    for (let i = 0; i < 10; i++) {
      const del = screen.getAllByRole('button', { name: /Delete course/i })[0];
      fireEvent.click(del);
    }

    expect(screen.queryAllByRole('button', { name: 'Open' })).toHaveLength(0);
    expect(undoButton).not.toBeDisabled();

    for (let i = 0; i < 10; i++) {
      fireEvent.click(undoButton);
    }

    expect(await screen.findAllByRole('button', { name: 'Open' })).toHaveLength(10);
    expect(undoButton).toBeDisabled();
  });

  it('shows course blocks and resolves them', async () => {
    const courses = [
      {
        id: 'c1',
        course: { id: 'c1', name: 'Course 1', description: '' },
        milestones: [{ id: 'm1', title: 'Milestone 1' }],
        tasks: [
          {
            id: 't1',
            title: 'Task 1',
            status: 'blocked',
            milestoneId: 'm1',
            blocks: [
              {
                id: 'b1',
                reportedAt: '2024-01-01',
                reportedBy: 'u1',
                description: 'Need approval',
                taggedMemberIds: ['u2'],
                resolvedAt: null,
                resolvedBy: null,
                resolution: '',
              },
              {
                id: 'b2',
                reportedAt: '2024-01-02',
                reportedBy: 'u2',
                description: 'Resolved earlier',
                taggedMemberIds: [],
                resolvedAt: '2024-01-03',
                resolvedBy: 'u3',
                resolution: 'Shared reference deck',
              },
            ],
          },
        ],
        team: [
          { id: 'u1', name: 'Alice', roleType: 'PM' },
          { id: 'u2', name: 'Bob', roleType: 'LD' },
          { id: 'u3', name: 'Cara', roleType: 'SME' },
        ],
        schedule: {},
      },
    ];
    localStorage.setItem('healthPM:courses:v1', JSON.stringify(courses));

    render(
      <CoursesHub
        onOpenCourse={() => {}}
        onEditTemplate={() => {}}
        onAddCourse={() => {}}
        onOpenUser={() => {}}
        people={courses[0].team}
        onPeopleChange={() => {}}
      />
    );

    await screen.findByText('Course 1');

    const toggle = screen.getByRole('button', { name: /Blocks/i });
    fireEvent.click(toggle);

    expect(await screen.findByText('Need approval')).toBeInTheDocument();
    expect(screen.getByText('Resolved earlier')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));

    const dialog = await screen.findByRole('dialog', { name: 'Resolve Block' });
    fireEvent.change(screen.getByLabelText('Resolution notes'), {
      target: { value: 'Approved by lead' },
    });
    fireEvent.change(screen.getByLabelText('Resolved by'), {
      target: { value: 'u2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve Block' }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(screen.queryByText('Need approval')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resolved (2)' }));
    expect(await screen.findByText('Approved by lead')).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem('healthPM:courses:v1'));
    const updated = stored[0].tasks[0].blocks.find((b) => b.id === 'b1');
    expect(updated.resolvedAt).toBeTruthy();
    expect(updated.resolution).toBe('Approved by lead');
  });

  it('restores a deleted course from version history without affecting others', async () => {
    const courses = [
      { id: 'c1', course: { id: 'c1', name: 'Course 1', description: 'Alpha' }, tasks: [], team: [], schedule: {} },
      { id: 'c2', course: { id: 'c2', name: 'Course 2', description: 'Beta' }, tasks: [], team: [], schedule: {} },
    ];
    localStorage.setItem('healthPM:courses:v1', JSON.stringify(courses));

    renderHub();

    await screen.findByText('Course 1');
    await screen.findByText('Course 2');

    const deleteButton = screen.getAllByRole('button', { name: /Delete course/i })[0];
    fireEvent.click(deleteButton);

    expect(screen.queryByText('Course 1')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Version history/i }));

    const retrieveButton = await screen.findByRole('button', { name: 'Retrieve' });
    fireEvent.click(retrieveButton);

    await waitFor(() => {
      expect(screen.getByText('Course 1')).toBeInTheDocument();
    });
    expect(screen.getByText('Course 2')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /Course version history/i })).not.toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem('healthPM:courses:v1'));
    expect(stored.map((c) => c.course.name)).toEqual(['Course 1', 'Course 2']);
    expect(addDoc).toHaveBeenCalled();
  });

  it('restores a platform backup snapshot from history', async () => {
    const currentCourses = [
      { id: 'c1', course: { id: 'c1', name: 'Original', description: '' }, tasks: [], team: [], schedule: {} },
    ];
    localStorage.setItem('healthPM:courses:v1', JSON.stringify(currentCourses));
    const backupSnapshot = {
      courses: [
        { id: 'c2', course: { id: 'c2', name: 'Restored Course', description: 'New' }, tasks: [], team: [], schedule: {} },
      ],
      schedule: { workweek: [1, 2, 3, 4, 5], holidays: [] },
      linkLibrary: [{ id: 'l1', label: 'Docs', url: 'https://example.com', pinned: false }],
      people: [{ id: 'p1', name: 'Jamie', roleType: 'PM' }],
      milestoneTemplates: [],
      soundEnabled: false,
    };
    const backupEntry = {
      id: 'backup-1',
      kind: 'backup',
      snapshot: backupSnapshot,
      summary: { courseCount: 1, peopleCount: 1, linkCount: 1, taskCount: 0, milestoneCount: 0, templateCount: 0 },
      label: 'PLATFORM BACKUP',
      createdAt: Date.now(),
      expiresAt: Date.now() + 604_800_000,
    };
    localStorage.setItem('healthPM:courseHistoryCache:v1', JSON.stringify([backupEntry]));

    const applyBackup = vi.fn().mockImplementation(async (entry) => {
      expect(entry.kind).toBe('backup');
      localStorage.setItem('healthPM:courses:v1', JSON.stringify(backupSnapshot.courses));
      localStorage.setItem('healthPM:linkLibrary:v1', JSON.stringify(backupSnapshot.linkLibrary));
      return backupSnapshot;
    });

    renderHub({ onApplyPlatformBackup: applyBackup });

    fireEvent.click(screen.getByRole('button', { name: /Version history/i }));
    await screen.findByText(/Platform backup/i);
    fireEvent.click(screen.getAllByRole('button', { name: 'Retrieve' })[0]);

    await waitFor(() => expect(applyBackup).toHaveBeenCalled());
    expect(await screen.findByText('Restored Course')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /Course version history/i })).not.toBeInTheDocument();

    const storedCourses = JSON.parse(localStorage.getItem('healthPM:courses:v1'));
    expect(storedCourses).toHaveLength(1);
    expect(storedCourses[0].course.name).toBe('Restored Course');
  });

  it('creates a daily platform backup and updates last run marker', async () => {
    vi.useFakeTimers();
    const now = new Date('2024-01-05T07:15:00.000Z').getTime();
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    localStorage.setItem('healthPM:courses:v1', JSON.stringify([]));
    localStorage.removeItem('healthPM:courseHistoryCache:v1');
    localStorage.setItem('healthPM:platformBackupLastRun:v1', String(now - 86_400_000));

    renderHub();

    await act(async () => {
      await Promise.resolve();
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    const cacheRaw = localStorage.getItem('healthPM:courseHistoryCache:v1');
    expect(cacheRaw).toBeTruthy();
    const cache = JSON.parse(cacheRaw);
    expect(cache[0].kind).toBe('backup');
    expect(cache[0].expiresAt - cache[0].createdAt).toBe(604_800_000);

    const boundary = (() => {
      const d = new Date(now);
      d.setHours(6, 0, 0, 0);
      if (now < d.getTime()) {
        d.setDate(d.getDate() - 1);
      }
      return d.getTime();
    })();
    expect(Number(localStorage.getItem('healthPM:platformBackupLastRun:v1'))).toBe(boundary);

    dateNowSpy.mockRestore();
    vi.useRealTimers();
  });

  it('purges expired platform backups after seven days', async () => {
    vi.useFakeTimers();
    const now = new Date('2024-01-10T08:00:00.000Z').getTime();
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const active = {
      id: 'backup-fresh',
      kind: 'backup',
      snapshot: { courses: [] },
      createdAt: now,
      expiresAt: now + 10_000,
    };
    const expired = {
      id: 'backup-old',
      kind: 'backup',
      snapshot: { courses: [] },
      createdAt: now - 10_000,
      expiresAt: now - 1,
    };
    localStorage.setItem('healthPM:courseHistoryCache:v1', JSON.stringify([active, expired]));
    localStorage.setItem('healthPM:courseHistoryPending:v1', JSON.stringify([]));
    localStorage.setItem('healthPM:platformBackupLastRun:v1', String(now));

    renderHub();

    await act(async () => {
      await Promise.resolve();
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    const cache = JSON.parse(localStorage.getItem('healthPM:courseHistoryCache:v1'));
    expect(cache).toHaveLength(1);
    expect(cache[0].id).toBe('backup-fresh');
    expect(deleteDoc).toHaveBeenCalled();

    dateNowSpy.mockRestore();
    vi.useRealTimers();
  });
});

