import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { CoursesHub } from './App.jsx';

vi.mock('./firebase.js', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn().mockResolvedValue(),
  doc: vi.fn(),
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
  });

  const renderHub = () =>
    render(
      <CoursesHub
        onOpenCourse={() => {}}
        onEditTemplate={() => {}}
        onAddCourse={() => {}}
        onOpenUser={() => {}}
        people={[]}
        onPeopleChange={() => {}}
      />
    );

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

    const deleteButton = screen.getAllByRole('button', { name: 'Delete' })[0];
    fireEvent.click(deleteButton);

    expect(screen.queryByText('Course 1')).toBeNull();
    expect(undoButton).not.toBeDisabled();

    fireEvent.click(undoButton);

    await screen.findByText('Course 1');
    expect(undoButton).toBeDisabled();
  });

  it('supports undoing up to five steps', async () => {
    const courses = Array.from({ length: 5 }, (_, i) => ({
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

    for (let i = 0; i < 5; i++) {
      const del = screen.getAllByRole('button', { name: 'Delete' })[0];
      fireEvent.click(del);
    }

    expect(screen.queryAllByRole('button', { name: 'Open' })).toHaveLength(0);
    expect(undoButton).not.toBeDisabled();

    for (let i = 0; i < 5; i++) {
      fireEvent.click(undoButton);
    }

    expect(await screen.findAllByRole('button', { name: 'Open' })).toHaveLength(5);
    expect(undoButton).toBeDisabled();
  });
});

