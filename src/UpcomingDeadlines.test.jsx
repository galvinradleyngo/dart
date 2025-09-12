import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserDashboard } from './App.jsx';
import { fmt } from './utils.js';

vi.mock('./firebase.js', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  doc: vi.fn(),
  setDoc: vi.fn(),
}));

describe('Upcoming Deadlines window', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows tasks due today and 14 days out', async () => {
    const today = new Date();
    const day14 = new Date();
    day14.setDate(today.getDate() + 14);
    const day15 = new Date();
    day15.setDate(today.getDate() + 15);

    const courses = [{
      course: { id: 'c1', name: 'Course 1' },
      tasks: [
        { id: 't1', title: 'Today Task', status: 'todo', dueDate: fmt(today), assigneeId: 'u1' },
        { id: 't2', title: 'Future Task', status: 'todo', dueDate: fmt(day14), assigneeId: 'u1' },
        { id: 't3', title: 'Outside Task', status: 'todo', dueDate: fmt(day15), assigneeId: 'u1' },
      ],
      team: [{ id: 'u1', name: 'Alice', roleType: 'LD' }],
      schedule: {},
    }];

    localStorage.setItem('healthPM:courses:v1', JSON.stringify(courses));

    render(<UserDashboard onOpenCourse={() => {}} onBack={() => {}} initialUserId="u1" />);

    expect(await screen.findByText('Today Task')).toBeInTheDocument();
    expect(await screen.findByText('Future Task')).toBeInTheDocument();
    expect(screen.queryByText('Outside Task')).toBeNull();
  });
});
