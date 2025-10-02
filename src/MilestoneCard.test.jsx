import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MilestoneCard from './MilestoneCard.jsx';
import { CoursePMApp } from './App.jsx';

const milestone = { id: 'm1', title: 'Milestone 1', goal: '', start: '' };

describe('MilestoneCard', () => {
  it('edits milestone title', () => {
    const onUpdateMilestone = vi.fn();
    render(<MilestoneCard milestone={milestone} onUpdateMilestone={onUpdateMilestone} />);

    const title = screen.getByText('Milestone 1');
    fireEvent.click(title);
    const input = screen.getByDisplayValue('Milestone 1');
    fireEvent.change(input, { target: { value: 'Updated Title' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(onUpdateMilestone).toHaveBeenCalledWith('m1', { title: 'Updated Title' });
  });

  it('colors progress bar based on completion', () => {
    const tasks = [
      { id: 't1', status: 'done' },
      { id: 't2', status: 'todo' },
    ];
    render(<MilestoneCard milestone={milestone} tasks={tasks} />);
    const pct = 50;
    const color = `hsl(${210 + (pct / 100) * (140 - 210)}, 70%, 50%)`;
    const bar = screen.getByTestId('progress-fill');
    expect(bar.getAttribute('style')).toContain(`background-color: ${color}`);
  });

  it('adds tasks from the collapsed summary button', () => {
    const onAddTask = vi.fn();
    const { container } = render(
      <MilestoneCard milestone={milestone} onAddTask={onAddTask} />,
    );

    const addButton = screen.getByLabelText(/add task/i);
    fireEvent.click(addButton);

    expect(onAddTask).toHaveBeenCalledWith('m1');
    const details = container.querySelector('details');
    expect(details?.open).toBe(true);
  });

  it('sorts tasks numerically by default', () => {
    const tasks = [
      { id: 't1', title: 'Task 12', status: 'todo', order: 0 },
      { id: 't2', title: 'Task 3', status: 'inprogress', order: 1 },
      { id: 't3', title: 'Task 22', status: 'blocked', order: 2 },
      { id: 't4', title: 'Task 1', status: 'todo', order: 3 },
      { id: 't5', title: 'Task without number', status: 'todo', order: 4 },
      { id: 't6', title: 'Task 105', status: 'todo', order: 5 },
      { id: 't7', title: 'Task 10', status: 'todo', order: 6 },
      { id: 't8', title: 'Task 9', status: 'todo', order: 7 },
      { id: 't9', title: 'Task 007', status: 'todo', order: 8 },
    ];

    render(<MilestoneCard milestone={milestone} tasks={tasks} tasksAll={tasks} />);

    const titles = screen
      .getAllByTestId('task-card')
      .map((card) => within(card).getByTitle('Click to edit').textContent);

    expect(titles).toEqual([
      'Task 1',
      'Task 3',
      'Task 007',
      'Task 9',
      'Task 10',
      'Task 12',
      'Task 22',
      'Task 105',
      'Task without number',
    ]);
  });

  it('sorts tasks alphabetically with numeric-aware precedence when requested', () => {
    const tasks = [
      { id: 't1', title: 'Task 12', status: 'todo', order: 0 },
      { id: 't2', title: '2 Kickoff', status: 'todo', order: 1 },
      { id: 't3', title: 'Task 3', status: 'todo', order: 2 },
      { id: 't4', title: '1 Outline', status: 'todo', order: 3 },
      { id: 't5', title: 'Task 22', status: 'todo', order: 4 },
      { id: 't6', title: 'Alpha brief', status: 'todo', order: 5 },
      { id: 't7', title: 'Task 007', status: 'todo', order: 6 },
      { id: 't8', title: 'beta sync', status: 'todo', order: 7 },
    ];

    render(
      <MilestoneCard milestone={milestone} tasks={tasks} tasksAll={tasks} taskSort="title" />,
    );

    const titles = screen
      .getAllByTestId('task-card')
      .map((card) => within(card).getByTitle('Click to edit').textContent);

    expect(titles).toEqual([
      '1 Outline',
      '2 Kickoff',
      'Task 3',
      'Task 007',
      'Task 12',
      'Task 22',
      'Alpha brief',
      'beta sync',
    ]);
  });

  it('sorts tasks by status when requested', () => {
    const tasks = [
      { id: 't1', title: 'Done task', status: 'done', order: 0 },
      { id: 't2', title: 'Todo task', status: 'todo', order: 2 },
      { id: 't3', title: 'Blocked task', status: 'blocked', order: 1 },
      { id: 't4', title: 'In progress task', status: 'inprogress', order: 3 },
      { id: 't5', title: 'Skipped task', status: 'skip', order: 4 },
    ];

    render(
      <MilestoneCard milestone={milestone} tasks={tasks} tasksAll={tasks} taskSort="status" />,
    );

    const titles = screen
      .getAllByTestId('task-card')
      .map((card) => within(card).getByTitle('Click to edit').textContent);

    expect(titles).toEqual([
      'Todo task',
      'In progress task',
      'Blocked task',
      'Done task',
      'Skipped task',
    ]);
  });

  it('sorts tasks by deadline recency when requested', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2024-05-10T00:00:00Z'));

      const tasks = [
        { id: 't1', title: 'No due date', status: 'todo', order: 0, dueDate: '' },
        { id: 't2', title: 'Due soon', status: 'todo', order: 1, dueDate: '2024-05-11' },
        { id: 't3', title: 'Due today', status: 'todo', order: 2, dueDate: '2024-05-10' },
        { id: 't4', title: 'Due earlier', status: 'todo', order: 3, dueDate: '2024-05-08' },
      ];

      render(
        <MilestoneCard milestone={milestone} tasks={tasks} tasksAll={tasks} taskSort="deadline" />,
      );

      const titles = screen
        .getAllByTestId('task-card')
        .map((card) => within(card).getByTitle('Click to edit').textContent);

      expect(titles).toEqual(['Due today', 'Due earlier', 'Due soon', 'No due date']);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('CoursePMApp milestone task sorting', () => {
  it('updates milestone task ordering when selecting different sort modes', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2024-05-10T00:00:00Z'));

      const boot = {
        course: { id: 'course-1', name: 'Course 1' },
        team: [],
        milestones: [
          { id: 'm1', title: 'Alpha Milestone', goal: '' },
        ],
        tasks: [
          { id: 't1', title: '11 Review', status: 'todo', order: 2, milestoneId: 'm1', dueDate: '2024-05-11' },
          { id: 't2', title: '2 Kickoff', status: 'inprogress', order: 1, milestoneId: 'm1', dueDate: '2024-05-09' },
          { id: 't3', title: 'Beta Task', status: 'blocked', order: 0, milestoneId: 'm1', dueDate: '2024-05-15' },
        ],
        linkLibrary: [],
        schedule: { workweek: [1, 2, 3, 4, 5], holidays: [] },
      };

      render(
        <CoursePMApp
          boot={boot}
          isTemplateLabel={false}
          onBack={() => {}}
          onStateChange={() => {}}
          people={[]}
          milestoneTemplates={[]}
          onChangeMilestoneTemplates={() => {}}
          onOpenUser={() => {}}
        />,
      );

      const readTaskTitles = () =>
        screen
          .getAllByTestId('task-card')
          .map((card) => within(card).getByTitle('Click to edit').textContent);

      expect(readTaskTitles()).toEqual(['2 Kickoff', '11 Review', 'Beta Task']);

      const selects = screen.getAllByLabelText('Sort tasks within milestones');
      expect(selects).toHaveLength(1);
      const [select] = selects;

      fireEvent.change(select, { target: { value: 'title' } });
      expect(readTaskTitles()).toEqual(['2 Kickoff', '11 Review', 'Beta Task']);

      fireEvent.change(select, { target: { value: 'status' } });
      expect(readTaskTitles()).toEqual(['11 Review', '2 Kickoff', 'Beta Task']);

      fireEvent.change(select, { target: { value: 'deadline' } });
      expect(readTaskTitles()).toEqual(['2 Kickoff', '11 Review', 'Beta Task']);
    } finally {
      vi.useRealTimers();
    }
  });
});

